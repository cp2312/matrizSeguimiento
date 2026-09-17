import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { findStepDef, etiquetaPaso, parseStepPath } from '../../../shared/pipelineTemplate.js';
import type { CellStatus } from '../../../shared/types.js';

export const auditoriaRouter = Router();

const TAMANO_PAGINA_MAX = 200;

interface FilaHistorial {
  id: number;
  subject_id: number;
  step_path: string;
  old_status: CellStatus | null;
  new_status: CellStatus;
  old_comment: string | null;
  new_comment: string | null;
  changed_at: string;
  asignatura: string;
  programa: string;
  full_name: string | null;
  initials: string | null;
}

/**
 * Registro de actividad: cada cambio de estado o comentario en cualquier
 * celda del sistema, de cualquier asignatura, más reciente primero. No hace
 * falta guardarlo aparte -- ya se llena solo en cell_history con cada guardado
 * (ver trigger trg_cells_historial en schema.sql); esto solo lo expone
 * paginado para que el administrador lo pueda ver.
 */
auditoriaRouter.get('/auditoria', requireAdmin, async (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.limit) || 50, 1), TAMANO_PAGINA_MAX);
  const desde = Math.max(Number(req.query.offset) || 0, 0);

  const [filas, totalFila] = await Promise.all([
    query<FilaHistorial>(
      `SELECT h.id, h.subject_id, h.step_path, h.old_status, h.new_status,
              h.old_comment, h.new_comment, h.changed_at,
              s.name AS asignatura, p.name AS programa,
              u.full_name, u.initials
       FROM cell_history h
       JOIN subjects s ON s.id = h.subject_id
       JOIN programs p ON p.id = s.program_id
       LEFT JOIN users u ON u.id = h.changed_by
       ORDER BY h.changed_at DESC, h.id DESC
       LIMIT $1 OFFSET $2`,
      [limite, desde]
    ),
    queryOne<{ total: number }>('SELECT COUNT(*)::int AS total FROM cell_history'),
  ]);

  const entradas = filas.map((f) => {
    const def = findStepDef(f.step_path);
    const { instance, blockKey } = parseStepPath(f.step_path);

    // Un paso repetible DENTRO de su bloque (p. ej. los reintentos de Turnitin
    // en "Libro") no tiene su propia instancia de apartado -- vive en el
    // apartado del bloque entero. Mismo criterio que agruparPasos en el
    // frontend (ver lib/bloques.ts), para que el link abra el apartado correcto.
    const instanciaDeBloque = instance && !def?.step.repeatable ? instance : null;

    return {
      id: f.id,
      changedAt: f.changed_at,
      subjectId: f.subject_id,
      programa: f.programa,
      asignatura: f.asignatura,
      bloque: def?.block.label ?? blockKey,
      paso: def ? etiquetaPaso(def.step, instance) : f.step_path,
      apartado: instanciaDeBloque ? `${blockKey}.${instanciaDeBloque}` : blockKey,
      oldStatus: f.old_status,
      newStatus: f.new_status,
      oldComment: f.old_comment,
      newComment: f.new_comment,
      usuario: f.full_name,
      iniciales: f.initials,
    };
  });

  res.json({ entradas, total: totalFila?.total ?? 0 });
});
