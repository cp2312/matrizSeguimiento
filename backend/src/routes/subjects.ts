import { Router } from 'express';
import type { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { totalSteps } from '../../../shared/pipelineTemplate.js';
import type { MatrixCell, Subject, SubjectTeacher } from '../../../shared/types.js';

export const subjectsRouter = Router();

interface DocenteEntrada {
  /** presente = docente ya existente (se actualiza); ausente = docente nuevo (se inserta) */
  id?: number;
  fullName?: string;
  startDate?: string | null;
  endDate?: string | null;
  contractType?: string | null;
}

/**
 * Valida la lista de docentes que llega del cliente. No hace falta ninguno al
 * crear la asignatura -- todavía no se sabe quién queda asignado -- pero si
 * llega alguno, sí necesita nombre.
 */
function validarDocentes(teachers: unknown): string | null {
  if (teachers === undefined) return null;
  if (!Array.isArray(teachers)) return 'Los docentes deben ser una lista';

  for (const t of teachers as DocenteEntrada[]) {
    if (!t.fullName?.trim()) {
      return 'Todos los docentes deben tener un nombre';
    }
  }
  return null;
}

/**
 * Sincroniza los docentes de una asignatura con la lista que llega del cliente,
 * dentro de una transaccion. A los que ya traen `id` se les hace UPDATE (conserva
 * su id); a los que no, INSERT; y se borra cualquier docente existente que ya no
 * venga en la lista.
 *
 * OJO: antes esto borraba y reinsertaba todos los docentes en cada guardado, lo
 * que les cambiaba el id incluso al editar un solo campo de uno solo. Como el
 * apartado "Tipo de contrato" guarda cada fecha por separado (onBlur de fecha
 * inicio, luego onBlur de fecha fin), ese cambio de id remontaba la lista completa
 * en el cliente a mitad de la edición y se perdía la fecha que se estaba por
 * escribir. Actualizar por id en vez de recrear todo lo evita.
 */
async function guardarDocentes(
  client: PoolClient, subjectId: number, teachers: DocenteEntrada[]
): Promise<SubjectTeacher[]> {
  const idsExistentes = teachers.filter((t) => t.id != null).map((t) => t.id!);

  await client.query(
    'DELETE FROM subject_teachers WHERE subject_id = $1 AND NOT (id = ANY($2::int[]))',
    [subjectId, idsExistentes]
  );

  const guardados: SubjectTeacher[] = [];
  for (const t of teachers) {
    if (t.id != null) {
      const { rows } = await client.query<SubjectTeacher>(
        // Si la fecha de fin cambió, se rehabilita el aviso de "contrato por
        // vencer" para esta fila -- si no, editar cualquier otro campo del
        // docente nunca volvería a avisar aunque se extienda el contrato.
        `UPDATE subject_teachers SET full_name=$1, start_date=$2, end_date=$3, contract_type=$4,
                contract_warning_sent_at = CASE WHEN end_date IS DISTINCT FROM $3 THEN NULL ELSE contract_warning_sent_at END
         WHERE id=$5 AND subject_id=$6 RETURNING *`,
        [t.fullName!.trim(), t.startDate ?? null, t.endDate ?? null, t.contractType ?? null, t.id, subjectId]
      );
      if (rows[0]) guardados.push(rows[0]);
    } else {
      const { rows } = await client.query<SubjectTeacher>(
        `INSERT INTO subject_teachers (subject_id, full_name, start_date, end_date, contract_type)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [subjectId, t.fullName!.trim(), t.startDate ?? null, t.endDate ?? null, t.contractType ?? null]
      );
      guardados.push(rows[0]);
    }
  }
  return guardados;
}

async function docentesDe(subjectId: number): Promise<SubjectTeacher[]> {
  return query<SubjectTeacher>(
    'SELECT * FROM subject_teachers WHERE subject_id = $1 ORDER BY id', [subjectId]
  );
}

/**
 * El tipo de contrato de cada docente se llena desde el apartado "Tipo de
 * contrato" (no al crear/editar la asignatura), asi que ese paso del proceso
 * se marca solo como terminado en cuanto algun docente tiene tipo de contrato
 * cargado -- no hace falta volver a marcarlo a mano. Si el paso ya tiene un
 * estado (por ejemplo alguien lo cambio a mano despues), no lo pisa.
 *
 * Devuelve la celda vigente (se haya tocado o no en esta llamada) para que
 * el cliente pueda reflejarla sin tener que recargar toda la matriz.
 */
async function marcarTipoContrato(
  client: PoolClient, subjectId: number, docentes: SubjectTeacher[],
  usuario: { id: number; initials: string } | undefined
): Promise<MatrixCell | null> {
  const hayTipoContrato = docentes.some((d) => d.contract_type?.trim());
  if (!hayTipoContrato || !usuario) return null;

  await client.query(
    `INSERT INTO matrix_cells (subject_id, step_path, status, done_date, initials, updated_by)
     VALUES ($1, 'contrato.tipo_contrato', 'terminado', CURRENT_DATE, $2, $3)
     ON CONFLICT (subject_id, step_path) DO NOTHING`,
    [subjectId, usuario.initials, usuario.id]
  );

  const { rows } = await client.query<MatrixCell>(
    `SELECT * FROM matrix_cells WHERE subject_id = $1 AND step_path = 'contrato.tipo_contrato'`,
    [subjectId]
  );
  return rows[0] ?? null;
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
    generalComment, videosPorDocente, teachers,
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
           modality, hybrid_program_label, rights_email_date, general_comment, videos_por_docente)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          req.params.programId, semester.trim(), name.trim(),
          bookName ?? null, creditos,
          modality ?? null, hybridProgramLabel ?? null, rightsEmailDate ?? null,
          generalComment ?? null, Boolean(videosPorDocente),
        ]
      );
      const asignatura = rows[0];
      const docentes = await guardarDocentes(client, asignatura.id, teachers ?? []);
      const contratoCelda = await marcarTipoContrato(client, asignatura.id, docentes, req.user);
      return { ...asignatura, teachers: docentes, contratoCelda };
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
           general_comment=$8, archived=$9, videos_por_docente=$10
         WHERE id=$11 RETURNING *`,
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
          valor('videosPorDocente', 'videos_por_docente'),
          req.params.id,
        ]
      );
      const asignatura = rows[0];

      const teachers = b.teachers !== undefined
        ? await guardarDocentes(client, asignatura.id, b.teachers)
        : await docentesDe(asignatura.id);

      const contratoCelda = await marcarTipoContrato(client, asignatura.id, teachers, req.user);
      return { ...asignatura, teachers, contratoCelda };
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
