import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { query, queryOne } from '../db/pool.js';
import { enviarAvisoPendiente } from '../lib/mailer.js';
import {
  buildStepPaths, isValidStepPath, findStepDef, totalSteps, pasosVisibles,
} from '../../../shared/pipelineTemplate.js';
import { CATEGORIAS_ENCARGADO } from '../../../shared/types.js';
import type { CategoriaEncargado, MatrixCell, Subject, SubjectTeacher } from '../../../shared/types.js';

// Estados que cuentan como "pendiente" para el aviso por correo
const ESTADOS_PENDIENTE = new Set(['pendiente_equipo', 'pendiente_jefe']);

/**
 * Si el paso pertenece a una de las categorías monitoreadas y su estado
 * acaba de pasar A pendiente (no si ya lo estaba), avisa por correo al
 * encargado de esa categoría, con un link directo al apartado. Nunca
 * lanza: un correo que falla no debe tumbar el guardado de la celda.
 */
async function avisarSiQuedaPendiente(
  blockKey: string, estadoAnterior: string | undefined, celda: MatrixCell, asignaturaNombre: string, pasoLabel: string
): Promise<void> {
  if (!(blockKey in CATEGORIAS_ENCARGADO)) return;
  if (celda.status !== 'pendiente_equipo' && celda.status !== 'pendiente_jefe') return;
  if (!ESTADOS_PENDIENTE.has(celda.status) || celda.status === estadoAnterior) return;

  try {
    const encargado = await queryOne<{ full_name: string; email: string }>(
      `SELECT u.full_name, u.email FROM category_owners co
       JOIN users u ON u.id = co.user_id
       WHERE co.category = $1 AND u.active`,
      [blockKey]
    );
    if (!encargado) return;

    // El "apartado" que abre el link es el step_path sin el último tramo:
    // "guias.1.recepcion_experto" -> "guias.1"; "contrato.tipo_contrato" -> "contrato"
    const apartado = celda.step_path.split('.').slice(0, -1).join('.');

    await enviarAvisoPendiente({
      paraEmail: encargado.email,
      paraNombre: encargado.full_name,
      asignatura: asignaturaNombre,
      categoria: CATEGORIAS_ENCARGADO[blockKey as CategoriaEncargado],
      paso: pasoLabel,
      estado: celda.status,
      subjectId: celda.subject_id,
      apartado,
    });
  } catch (err) {
    console.error('[matrix] Error al avisar por correo:', err);
  }
}

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

    // Los pasos condicionales que ya se descartaron (p. ej. "No hay ajustes") no
    // cuentan para el avance -- si no, nunca se llega al 100% aunque esté todo hecho.
    const visibles = pasosVisibles(pasos, celdas);
    const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;

    res.json({
      asignatura: { ...asignatura, teachers },
      pasos,
      celdas,
      avance: {
        terminados,
        total: visibles.length,
        porcentaje: Math.round((terminados / visibles.length) * 100),
      },
    });
  });

  // Guardar o actualizar una celda
router.patch('/subjects/:subjectId/matrix/*stepPath', async (req, res) => {
  const { subjectId } = req.params;
  // En Express 5 un comodin "*nombre" llega como array de segmentos, no como string
  const stepPathParam = (req.params as any).stepPath;
  const stepPath = Array.isArray(stepPathParam) ? stepPathParam.join('/') : stepPathParam;

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

    // Para saber si el estado recién ENTRA a pendiente (y no si ya lo estaba)
    const celdaPrevia = await queryOne<{ status: string }>(
      'SELECT status FROM matrix_cells WHERE subject_id = $1 AND step_path = $2',
      [subjectId, stepPath]
    );

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

      if (!celda) throw new Error('El INSERT ... RETURNING no devolvió fila');

      // Tiempo real: todos los que vean esta asignatura reciben el cambio
      io.to(`subject:${subjectId}`).emit('cell:updated', celda);

      // Aviso por correo: no se espera a que termine para responder al cliente
      void avisarSiQuedaPendiente(def.block.key, celdaPrevia?.status, celda, asignatura.name, def.step.label);

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
    `SELECT c.* FROM matrix_cells c
     JOIN subjects s ON s.id = c.subject_id
     WHERE s.program_id = $1`,
    [req.params.id]
  );

  // Agrupa las celdas por asignatura, indexadas por step_path (para poder
  // resolver branch_value igual que en la matriz de una asignatura)
  const celdasPorAsignatura = new Map<number, Record<string, MatrixCell>>();
  for (const celda of celdas) {
    const mapa = celdasPorAsignatura.get(celda.subject_id) ?? {};
    mapa[celda.step_path] = celda;
    celdasPorAsignatura.set(celda.subject_id, mapa);
  }

  const resultado = asignaturas.map((a) => {
    const celdasDeAsignatura = celdasPorAsignatura.get(a.id) ?? {};

    // Los pasos condicionales ya descartados (p. ej. "No hay ajustes") ni cuentan
    // ni pintan de blanco un bloque que en realidad ya está completo del todo.
    const pasos = pasosVisibles(buildStepPaths(a.credits), celdasDeAsignatura);

    const estados: Record<string, string[]> = {};
    for (const p of pasos) {
      (estados[p.blockKey] ??= []).push(celdasDeAsignatura[p.path]?.status ?? 'vacio');
    }

    const terminados = pasos.filter((p) => celdasDeAsignatura[p.path]?.status === 'terminado').length;

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