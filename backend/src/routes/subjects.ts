import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { totalSteps } from '../../../shared/pipelineTemplate.js';
import type { Subject } from '../../../shared/types.js';

export const subjectsRouter = Router();

// Asignaturas de un programa
subjectsRouter.get('/programs/:programId/subjects', async (req, res) => {
  const asignaturas = await query<Subject>(
    `SELECT * FROM subjects
     WHERE program_id = $1 AND NOT archived
     ORDER BY semester, name`,
    [req.params.programId]
  );

  res.json(asignaturas);
});

// Crear asignatura
subjectsRouter.post('/programs/:programId/subjects', async (req, res) => {
  const {
    semester, name, teachersComment, bookName, credits,
    modality, hybridProgramLabel, rightsEmailDate,
    deliverableStartDate, deliverableEndDate,
    contractType, contractComment, generalComment,
  } = req.body;

  if (!semester?.trim() || !name?.trim()) {
    return res.status(400).json({ error: 'Semestre y nombre son obligatorios' });
  }

  const creditos = Number(credits ?? 1);
  if (!Number.isInteger(creditos) || creditos < 1 || creditos > 5) {
    return res.status(400).json({ error: 'Los créditos deben estar entre 1 y 5' });
  }

  try {
    const asignatura = await queryOne<Subject>(
      `INSERT INTO subjects
        (program_id, semester, name, teachers_comment, book_name, credits,
         modality, hybrid_program_label, rights_email_date,
         deliverable_start_date, deliverable_end_date,
         contract_type, contract_comment, general_comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        req.params.programId, semester.trim(), name.trim(),
        teachersComment ?? null, bookName ?? null, creditos,
        modality ?? null, hybridProgramLabel ?? null, rightsEmailDate ?? null,
        deliverableStartDate ?? null, deliverableEndDate ?? null,
        contractType ?? null, contractComment ?? null, generalComment ?? null,
      ]
    );

    res.status(201).json(asignatura);
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

  res.json({ ...asignatura, total_pasos: totalSteps(asignatura.credits) });
});

// Editar
subjectsRouter.patch('/subjects/:id', async (req, res) => {
  const existente = await queryOne<any>('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
  if (!existente) return res.status(404).json({ error: 'Asignatura no encontrada' });

  const b = req.body;
  const valor = (camel: string, col: string) => (b[camel] !== undefined ? b[camel] : existente[col]);

  try {
    const asignatura = await queryOne<Subject>(
      `UPDATE subjects SET
         semester=$1, name=$2, teachers_comment=$3, book_name=$4, credits=$5,
         modality=$6, hybrid_program_label=$7, rights_email_date=$8,
         deliverable_start_date=$9, deliverable_end_date=$10,
         contract_type=$11, contract_comment=$12, general_comment=$13, archived=$14
       WHERE id=$15 RETURNING *`,
      [
        valor('semester', 'semester'),
        valor('name', 'name'),
        valor('teachersComment', 'teachers_comment'),
        valor('bookName', 'book_name'),
        valor('credits', 'credits'),
        valor('modality', 'modality'),
        valor('hybridProgramLabel', 'hybrid_program_label'),
        valor('rightsEmailDate', 'rights_email_date'),
        valor('deliverableStartDate', 'deliverable_start_date'),
        valor('deliverableEndDate', 'deliverable_end_date'),
        valor('contractType', 'contract_type'),
        valor('contractComment', 'contract_comment'),
        valor('generalComment', 'general_comment'),
        valor('archived', 'archived'),
        req.params.id,
      ]
    );

    res.json(asignatura);
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