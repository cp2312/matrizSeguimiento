import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { query, queryOne } from '../db/pool.js';
import {
  buildStepPaths, isValidStepPath, findStepDef, totalSteps,
} from '../../../shared/pipelineTemplate.js';
import type { MatrixCell, Subject } from '../../../shared/types.js';

export function buildMatrixRouter(io: SocketIOServer) {
  const router = Router();

  // Traer la matriz completa de una asignatura
  router.get('/subjects/:id/matrix', async (req, res) => {
    const asignatura = await queryOne<Subject>(
      'SELECT * FROM subjects WHERE id = $1', [req.params.id]
    );
    if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

    // El pipeline dice qué pasos le corresponden según sus créditos
    const pasos = buildStepPaths(asignatura.credits);

    // La base dice cuáles ya se tocaron
    const filas = await query<MatrixCell>(
      'SELECT * FROM matrix_cells WHERE subject_id = $1', [req.params.id]
    );

    const celdas: Record<string, MatrixCell> = {};
    for (const fila of filas) celdas[fila.step_path] = fila;

    const terminados = filas.filter(f => f.status === 'terminado').length;

    res.json({
      asignatura,
      pasos,
      celdas,
      avance: {
        terminados,
        total: pasos.length,
        porcentaje: Math.round((terminados / pasos.length) * 100),
      },
    });
  });

  // Guardar o actualizar una celda
router.patch('/subjects/:subjectId/matrix/*stepPath', async (req, res) => {
  const { subjectId } = req.params;
  const stepPath = (req.params as any).stepPath as string;
  // ...

    const asignatura = await queryOne<Subject>(
      'SELECT * FROM subjects WHERE id = $1', [subjectId]
    );
    if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

    // El pipeline valida que el paso exista y la instancia esté en rango
    if (!isValidStepPath(stepPath, asignatura.credits)) {
      return res.status(400).json({ error: `El paso "${stepPath}" no aplica a esta asignatura` });
    }

    const def = findStepDef(stepPath)!;
    const { status, doneDate, comment, branchValue } = req.body;

    // Comentario obligatorio
    if (def.step.commentRequired && status === 'terminado' && !comment?.trim()) {
      return res.status(400).json({
        error: `"${def.step.label}" requiere ${def.step.commentLabel ?? 'un comentario'}`,
      });
    }

    // Solo los pasos de decisión aceptan branchValue
    if (branchValue !== undefined && branchValue !== null && !def.step.isBranchPoint) {
      return res.status(400).json({ error: `"${def.step.label}" no es un paso de decisión` });
    }

    // Las iniciales salen del usuario, no del cliente
    const usuario = (req as any).user ?? { id: null, initials: null };

    try {
      const celda = await queryOne<MatrixCell>(
        `INSERT INTO matrix_cells
           (subject_id, step_path, status, done_date, initials, comment, branch_value, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (subject_id, step_path)
         DO UPDATE SET
           status       = EXCLUDED.status,
           done_date    = EXCLUDED.done_date,
           initials     = EXCLUDED.initials,
           comment      = EXCLUDED.comment,
           branch_value = EXCLUDED.branch_value,
           updated_by   = EXCLUDED.updated_by
         RETURNING *`,
        [
          subjectId, stepPath, status ?? 'vacio',
          doneDate ?? null, usuario.initials,
          comment ?? null,
          def.step.isBranchPoint ? branchValue ?? null : null,
          usuario.id,
        ]
      );

      // Tiempo real: todos los que vean esta asignatura reciben el cambio
      io.to(`subject:${subjectId}`).emit('cell:updated', celda);

      res.json(celda);
    } catch (err: any) {
      if (err.code === '23514') {
        return res.status(400).json({
          error: 'Para marcar como terminado hay que registrar la fecha',
        });
      }
      throw err;
    }
  });

  // Historial de una asignatura
  router.get('/subjects/:id/historial', async (req, res) => {
    const historial = await query(
      `SELECT h.step_path, h.old_status, h.new_status, h.changed_at, u.full_name, u.initials
       FROM cell_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.subject_id = $1
       ORDER BY h.changed_at DESC
       LIMIT 100`,
      [req.params.id]
    );

    res.json(historial);
  });

  return router;
}