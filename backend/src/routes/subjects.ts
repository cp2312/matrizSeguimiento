import { Router } from 'express';
import type { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { totalSteps } from '../../../shared/pipelineTemplate.js';
import type { Subject, SubjectTeacher } from '../../../shared/types.js';

export const subjectsRouter = Router();

interface DocenteEntrada {
  fullName?: string;
  startDate?: string | null;
  endDate?: string | null;
  contractType?: string | null;
}

/** Valida la lista de docentes que llega del cliente. Devuelve el error o null. */
function validarDocentes(teachers: unknown): string | null {
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return 'La asignatura debe tener al menos un docente';
  }
  for (const t of teachers as DocenteEntrada[]) {
    if (!t.fullName?.trim()) {
      return 'Todos los docentes deben tener un nombre';
    }
  }
  return null;
}

/** Reemplaza por completo los docentes de una asignatura dentro de una transaccion. */
async function guardarDocentes(
  client: PoolClient, subjectId: number, teachers: DocenteEntrada[]
): Promise<SubjectTeacher[]> {
  await client.query('DELETE FROM subject_teachers WHERE subject_id = $1', [subjectId]);

  const guardados: SubjectTeacher[] = [];
  for (const t of teachers) {
    const { rows } = await client.query<SubjectTeacher>(
      `INSERT INTO subject_teachers (subject_id, full_name, start_date, end_date, contract_type)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [subjectId, t.fullName!.trim(), t.startDate ?? null, t.endDate ?? null, t.contractType ?? null]
    );
    guardados.push(rows[0]);
  }
  return guardados;
}

async function docentesDe(subjectId: number): Promise<SubjectTeacher[]> {
  return query<SubjectTeacher>(
    'SELECT * FROM subject_teachers WHERE subject_id = $1 ORDER BY id', [subjectId]
  );
}

// Asignaturas de un programa
subjectsRouter.get('/programs/:programId/subjects', async (req, res) => {
  const asignaturas = await query<Subject>(
    `SELECT * FROM subjects
     WHERE program_id = $1 AND NOT archived
     ORDER BY semester, name`,
    [req.params.programId]
  );

  const docentes = await query<SubjectTeacher>(
    `SELECT t.* FROM subject_teachers t
     JOIN subjects s ON s.id = t.subject_id
     WHERE s.program_id = $1 AND NOT s.archived
     ORDER BY t.id`,
    [req.params.programId]
  );
  const porAsignatura = new Map<number, SubjectTeacher[]>();
  for (const d of docentes) {
    if (!porAsignatura.has(d.subject_id)) porAsignatura.set(d.subject_id, []);
    porAsignatura.get(d.subject_id)!.push(d);
  }

  res.json(asignaturas.map((a) => ({ ...a, teachers: porAsignatura.get(a.id) ?? [] })));
});

// Crear asignatura
subjectsRouter.post('/programs/:programId/subjects', async (req, res) => {
  const {
    semester, name, bookName, credits,
    modality, hybridProgramLabel, rightsEmailDate,
    generalComment, teachers,
  } = req.body;

  if (!semester?.trim() || !name?.trim()) {
    return res.status(400).json({ error: 'Semestre y nombre son obligatorios' });
  }

  const creditos = Number(credits ?? 1);
  if (!Number.isInteger(creditos) || creditos < 1 || creditos > 5) {
    return res.status(400).json({ error: 'Los créditos deben estar entre 1 y 5' });
  }

  const errorDocentes = validarDocentes(teachers);
  if (errorDocentes) return res.status(400).json({ error: errorDocentes });

  try {
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query<Subject>(
        `INSERT INTO subjects
          (program_id, semester, name, book_name, credits,
           modality, hybrid_program_label, rights_email_date, general_comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          req.params.programId, semester.trim(), name.trim(),
          bookName ?? null, creditos,
          modality ?? null, hybridProgramLabel ?? null, rightsEmailDate ?? null,
          generalComment ?? null,
        ]
      );
      const asignatura = rows[0];
      const docentes = await guardarDocentes(client, asignatura.id, teachers);
      return { ...asignatura, teachers: docentes };
    });

    res.status(201).json(resultado);
  } catch (err: any) {
    // Los triggers y CHECK de la base devuelven mensajes útiles
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe esa asignatura en el semestre' });
    }
    if (err.code === 'P0001' || err.code === '23514') {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

// Una asignatura
subjectsRouter.get('/subjects/:id', async (req, res) => {
  const asignatura = await queryOne<Subject>('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
  if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

  const teachers = await docentesDe(asignatura.id);
  res.json({ ...asignatura, teachers, total_pasos: totalSteps(asignatura.credits) });
});

// Editar
subjectsRouter.patch('/subjects/:id', async (req, res) => {
  const existente = await queryOne<any>('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
  if (!existente) return res.status(404).json({ error: 'Asignatura no encontrada' });

  const b = req.body;
  const valor = (camel: string, col: string) => (b[camel] !== undefined ? b[camel] : existente[col]);

  if (b.teachers !== undefined) {
    const errorDocentes = validarDocentes(b.teachers);
    if (errorDocentes) return res.status(400).json({ error: errorDocentes });
  }

  try {
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query<Subject>(
        `UPDATE subjects SET
           semester=$1, name=$2, book_name=$3, credits=$4,
           modality=$5, hybrid_program_label=$6, rights_email_date=$7,
           general_comment=$8, archived=$9
         WHERE id=$10 RETURNING *`,
        [
          valor('semester', 'semester'),
          valor('name', 'name'),
          valor('bookName', 'book_name'),
          valor('credits', 'credits'),
          valor('modality', 'modality'),
          valor('hybridProgramLabel', 'hybrid_program_label'),
          valor('rightsEmailDate', 'rights_email_date'),
          valor('generalComment', 'general_comment'),
          valor('archived', 'archived'),
          req.params.id,
        ]
      );
      const asignatura = rows[0];

      const teachers = b.teachers !== undefined
        ? await guardarDocentes(client, asignatura.id, b.teachers)
        : await docentesDe(asignatura.id);

      return { ...asignatura, teachers };
    });

    res.json(resultado);
  } catch (err: any) {
    if (err.code === 'P0001' || err.code === '23514') {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

subjectsRouter.delete('/subjects/:id', async (req, res) => {
  await query('DELETE FROM subjects WHERE id = $1', [req.params.id]);
  res.status(204).send();
});
