import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { query, queryOne } from '../db/pool.js';
import {
  buildStepPaths, isValidStepPath, findStepDef, totalSteps,
} from '../../../shared/pipelineTemplate.js';
import type { MatrixCell, Subject, SubjectTeacher } from '../../../shared/types.js';

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
    const teachers = await query<SubjectTeacher>(
      'SELECT * FROM subject_teachers WHERE subject_id = $1 ORDER BY id', [req.params.id]
    );

    const celdas: Record<string, MatrixCell> = {};
    for (const fila of filas) celdas[fila.step_path] = fila;

    const terminados = filas.filter(f => f.status === 'terminado').length;

    res.json({
      asignatura: { ...asignatura, teachers },
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
// Tablero del programa: cada asignatura con el estado resumido de cada bloque
router.get('/programs/:id/tablero', async (req, res) => {
  const asignaturas = await query<Subject>(
    `SELECT * FROM subjects
     WHERE program_id = $1 AND NOT archived
     ORDER BY semester, name`,
    [req.params.id]
  );

  if (!asignaturas.length) return res.json([]);

  const celdas = await query<MatrixCell>(
    `SELECT c.subject_id, c.step_path, c.status
     FROM matrix_cells c
     JOIN subjects s ON s.id = c.subject_id
     WHERE s.program_id = $1`,
    [req.params.id]
  );

  // Agrupa los estados por asignatura y bloque
  const porAsignatura = new Map<number, Map<string, string[]>>();

  for (const celda of celdas) {
    const bloque = celda.step_path.split('.')[0];
    if (!porAsignatura.has(celda.subject_id)) porAsignatura.set(celda.subject_id, new Map());
    const bloques = porAsignatura.get(celda.subject_id)!;
    if (!bloques.has(bloque)) bloques.set(bloque, []);
    bloques.get(bloque)!.push(celda.status);
  }

  const resultado = asignaturas.map((a) => {
    const pasos = buildStepPaths(a.credits);
    const bloques = porAsignatura.get(a.id) ?? new Map<string, string[]>();

    // Cuenta cuántos pasos totales tiene cada bloque, para saber si está completo
    const totalPorBloque = new Map<string, number>();
    for (const p of pasos) {
      totalPorBloque.set(p.blockKey, (totalPorBloque.get(p.blockKey) ?? 0) + 1);
    }

    const estados: Record<string, string[]> = {};
    for (const [bloque, total] of totalPorBloque) {
      const guardados = bloques.get(bloque) ?? [];
      // Los pasos sin fila cuentan como vacíos
      estados[bloque] = [
        ...guardados,
        ...Array(Math.max(0, total - guardados.length)).fill('vacio'),
      ];
    }

    const terminados = [...bloques.values()]
      .flat()
      .filter((s) => s === 'terminado').length;

    return {
      ...a,
      estadosPorBloque: estados,
      avance: Math.round((terminados / pasos.length) * 100),
    };
  });

  res.json(resultado);
});
  
  return router;

  
}