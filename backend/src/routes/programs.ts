import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import type { Program, ProgramLevel, ProgramType } from '../../../shared/types.js';

export const programsRouter = Router();

const TIPOS_VALIDOS: ProgramType[] = ['hibrido', 'presencial', 'virtual'];
const NIVELES_VALIDOS: ProgramLevel[] = ['pregrado', 'posgrado'];
/** Semestre estimado de apertura: 'AAAA-1' o 'AAAA-2' (mismo espíritu que subjects.semester) */
const FORMATO_FECHA_APERTURA = /^\d{4}-[12]$/;

function validarFechaApertura(valor: unknown): string | null | undefined {
  if (valor === undefined) return undefined; // no vino en el body -- no tocar
  if (valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !FORMATO_FECHA_APERTURA.test(valor)) {
    throw new Error('La fecha estimada de apertura debe tener el formato AAAA-1 o AAAA-2');
  }
  return valor;
}

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
  res.json(programa);
});

// Crear
programsRouter.post('/', async (req, res) => {
  const { name, notes, type, academicLevel, fechaApertura } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'El nombre del programa es obligatorio' });
  }

  const tipo = type ?? 'presencial';
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: 'El tipo debe ser hibrido, presencial o virtual' });
  }

  // Un programa virtual siempre indica si es de pregrado o posgrado; los
  // demás tipos no lo piden (queda en null aunque venga algo en el body).
  let nivel: ProgramLevel | null = null;
  if (tipo === 'virtual') {
    if (!NIVELES_VALIDOS.includes(academicLevel)) {
      return res.status(400).json({ error: 'Un programa virtual debe indicar si es de pregrado o posgrado' });
    }
    nivel = academicLevel;
  }

  let fecha: string | null | undefined;
  try {
    fecha = validarFechaApertura(fechaApertura);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  const programa = await queryOne<Program>(
    `INSERT INTO programs (name, notes, type, academic_level, fecha_apertura) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name.trim(), notes ?? null, tipo, nivel, fecha ?? null]
  );

  res.status(201).json(programa);
});

// Editar
programsRouter.patch('/:id', async (req, res) => {
  const existente = await queryOne<Program>('SELECT * FROM programs WHERE id = $1', [req.params.id]);
  if (!existente) return res.status(404).json({ error: 'Programa no encontrado' });

  const { name, notes, type, archived, academicLevel, fechaApertura } = req.body;

  if (type !== undefined && !TIPOS_VALIDOS.includes(type)) {
    return res.status(400).json({ error: 'El tipo debe ser hibrido, presencial o virtual' });
  }

  const tipoFinal = type ?? existente.type;

  let nivel: ProgramLevel | null = null;
  if (tipoFinal === 'virtual') {
    const candidato = academicLevel !== undefined ? academicLevel : existente.academic_level;
    if (!NIVELES_VALIDOS.includes(candidato)) {
      return res.status(400).json({ error: 'Un programa virtual debe indicar si es de pregrado o posgrado' });
    }
    nivel = candidato;
  }

  let fecha: string | null | undefined;
  try {
    fecha = validarFechaApertura(fechaApertura);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  const programa = await queryOne<Program>(
    `UPDATE programs SET name = $1, notes = $2, type = $3, archived = $4, academic_level = $5, fecha_apertura = $6
     WHERE id = $7 RETURNING *`,
    [
      name?.trim() ?? existente.name,
      notes !== undefined ? notes : existente.notes,
      tipoFinal,
      archived !== undefined ? Boolean(archived) : existente.archived,
      nivel,
      fecha !== undefined ? fecha : existente.fecha_apertura,
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
