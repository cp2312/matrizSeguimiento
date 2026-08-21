import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import type { Program } from '../../../shared/types.js';

export const programsRouter = Router();

// Listar programas
programsRouter.get('/', async (req, res) => {
  const incluirArchivados = req.query.archivados === 'true';

  const programas = await query<Program>(
    `SELECT * FROM programs
     WHERE ($1::boolean OR NOT archived)
     ORDER BY archived, name`,
    [incluirArchivados]
  );

  res.json(programas);
});


programsRouter.get('/:id', async (req, res) => {
  const programa = await queryOne<Program>('SELECT * FROM programs WHERE id = $1', [req.params.id]);
  if (!programa) return res.status(404).json({ error: 'Programa no encontrado' });

  const asignaturas = await query(
    `SELECT * FROM v_avance_asignaturas
     WHERE program_id = $1
     ORDER BY semestre, asignatura`,
    [req.params.id]
  );

  res.json({ programa, asignaturas });
});

// Crear
programsRouter.post('/', async (req, res) => {
  const { name, notes, isHybrid } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'El nombre del programa es obligatorio' });
  }

  const programa = await queryOne<Program>(
    `INSERT INTO programs (name, notes, is_hybrid) VALUES ($1, $2, $3) RETURNING *`,
    [name.trim(), notes ?? null, Boolean(isHybrid)]
  );

  res.status(201).json(programa);
});

// Editar
programsRouter.patch('/:id', async (req, res) => {
  const existente = await queryOne<Program>('SELECT * FROM programs WHERE id = $1', [req.params.id]);
  if (!existente) return res.status(404).json({ error: 'Programa no encontrado' });

  const { name, notes, isHybrid, archived } = req.body;

  const programa = await queryOne<Program>(
    `UPDATE programs SET name = $1, notes = $2, is_hybrid = $3, archived = $4
     WHERE id = $5 RETURNING *`,
    [
      name?.trim() ?? existente.name,
      notes !== undefined ? notes : existente.notes,
      isHybrid !== undefined ? Boolean(isHybrid) : existente.is_hybrid,
      archived !== undefined ? Boolean(archived) : existente.archived,
      req.params.id,
    ]
  );

  res.json(programa);
});

// Eliminar (borra en cascada asignaturas, celdas e historial)
programsRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM programs WHERE id = $1', [req.params.id]);
  res.status(204).send();
});