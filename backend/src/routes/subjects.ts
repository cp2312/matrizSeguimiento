import { Router } from 'express';
import type { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { totalSteps } from '../../../shared/pipelineTemplate.js';
import { hoyISO } from '../../../shared/businessDays.js';
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

  if (b.bookDueDate && b.bookDueDate < hoyISO()) {
    return res.status(400).json({ error: 'La fecha tentativa no puede ser anterior a hoy' });
  }

  try {
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query<Subject>(
        // Si la fecha tentativa de entrega del libro cambió, se rehabilita el
        // aviso de "libro no entregado" -- si no, nunca volvería a avisar
        // aunque se dé una nueva fecha.
        `UPDATE subjects SET
           semester=$1, name=$2, book_name=$3, credits=$4,
           modality=$5, hybrid_program_label=$6, rights_email_date=$7,
           general_comment=$8, archived=$9, videos_por_docente=$10, book_due_date=$11,
           book_due_warning_sent_at = CASE WHEN book_due_date IS DISTINCT FROM $11 THEN NULL ELSE book_due_warning_sent_at END
         WHERE id=$12 RETURNING *`,
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
          valor('bookDueDate', 'book_due_date'),
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

// Reiniciar matriz: borra todo el avance de los pasos y los docentes
// asignados -- como si el proceso volviera a empezar de cero, pero con la
// asignatura ya creada (nombre, créditos, libro, etc. no se tocan). No
// restaura instancias quitadas/bloqueadas (ver removedInstances.ts) -- eso
// se maneja aparte, esto solo es el avance. Antes de borrar nada, guarda una
// copia completa en subject_reset_backups (ver GET/POST .../backups abajo).
subjectsRouter.post('/subjects/:id/reiniciar', async (req, res) => {
  const existente = await queryOne<Subject>('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
  if (!existente) return res.status(404).json({ error: 'Asignatura no encontrada' });

  await withTransaction(async (client) => {
    const { rows: celdas } = await client.query<MatrixCell>(
      'SELECT * FROM matrix_cells WHERE subject_id = $1', [req.params.id]
    );
    const { rows: teachers } = await client.query<SubjectTeacher>(
      'SELECT * FROM subject_teachers WHERE subject_id = $1', [req.params.id]
    );

    await client.query(
      `INSERT INTO subject_reset_backups (subject_id, celdas, teachers, created_by)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, JSON.stringify(celdas), JSON.stringify(teachers), req.user?.id ?? null]
    );

    await client.query('DELETE FROM matrix_cells WHERE subject_id = $1', [req.params.id]);
    await client.query('DELETE FROM subject_teachers WHERE subject_id = $1', [req.params.id]);
    await client.query('UPDATE subjects SET completion_email_sent_at = NULL WHERE id = $1', [req.params.id]);
  });

  res.status(204).send();
});

interface FilaBackup {
  id: number;
  created_at: string;
  full_name: string | null;
  celdas: MatrixCell[];
  teachers: SubjectTeacher[];
}

// Copias de seguridad guardadas por "Reiniciar matriz" -- solo lectura, para
// que un administrador pueda revisar o restaurar una asignatura reiniciada
// por error. Más reciente primero.
subjectsRouter.get('/subjects/:id/backups', requireAdmin, async (req, res) => {
  const filas = await query<FilaBackup>(
    `SELECT b.id, b.created_at, b.celdas, b.teachers, u.full_name
     FROM subject_reset_backups b
     LEFT JOIN users u ON u.id = b.created_by
     WHERE b.subject_id = $1
     ORDER BY b.created_at DESC`,
    [req.params.id]
  );

  res.json(filas.map((f) => ({
    id: f.id,
    createdAt: f.created_at,
    creadoPor: f.full_name,
    celdasCount: f.celdas.length,
    teachersCount: f.teachers.length,
  })));
});

// Restaura una copia de seguridad: reemplaza las celdas y docentes actuales
// de la asignatura por los que tenía guardados esa copia. Como "Reiniciar
// matriz" siempre la deja vacía antes de la copia siguiente, no hay
// conflictos que resolver -- simplemente se reinsertan tal cual estaban.
subjectsRouter.post('/subjects/:id/backups/:backupId/restaurar', requireAdmin, async (req, res) => {
  const backup = await queryOne<{ celdas: MatrixCell[]; teachers: SubjectTeacher[] }>(
    'SELECT celdas, teachers FROM subject_reset_backups WHERE id = $1 AND subject_id = $2',
    [req.params.backupId, req.params.id]
  );
  if (!backup) return res.status(404).json({ error: 'Copia de seguridad no encontrada' });

  await withTransaction(async (client) => {
    await client.query('DELETE FROM matrix_cells WHERE subject_id = $1', [req.params.id]);
    await client.query('DELETE FROM subject_teachers WHERE subject_id = $1', [req.params.id]);

    for (const c of backup.celdas) {
      await client.query(
        `INSERT INTO matrix_cells
           (subject_id, step_path, status, done_date, initials, comment, second_comment,
            branch_value, due_date, due_date_warning_sent_at, reference_date, assigned_note,
            version, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          req.params.id, c.step_path, c.status, c.done_date, c.initials, c.comment, c.second_comment,
          c.branch_value, c.due_date, c.due_date_warning_sent_at, c.reference_date, c.assigned_note,
          c.version, c.updated_by,
        ]
      );
    }

    for (const t of backup.teachers) {
      await client.query(
        `INSERT INTO subject_teachers (subject_id, full_name, start_date, end_date, contract_type)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, t.full_name, t.start_date, t.end_date, t.contract_type]
      );
    }
  });

  res.status(204).send();
});
