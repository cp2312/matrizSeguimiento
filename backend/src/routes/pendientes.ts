import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { buildStepPaths, pasosVisibles, excluirInstanciasExtraSinUsar } from '../../../shared/pipelineTemplate.js';
import type { MatrixCell, PendientesPrograma, Subject } from '../../../shared/types.js';

export const pendientesRouter = Router();

/**
 * Reporte de "qué falta" de un programa: por cada asignatura, la lista de
 * pasos que todavía NO están en 'terminado' (los mismos que cuentan para el
 * avance, ver pasosVisibles/excluirInstanciasExtraSinUsar) -- para verlo de
 * una sola vez, sin entrar asignatura por asignatura.
 */
pendientesRouter.get('/programs/:id/pendientes', async (req, res) => {
  const programId = req.params.id;

  const programa = await queryOne<{ id: number; name: string }>(
    'SELECT id, name FROM programs WHERE id = $1', [programId]
  );
  if (!programa) return res.status(404).json({ error: 'Programa no encontrado' });

  const asignaturas = await query<Subject>(
    `SELECT * FROM subjects WHERE program_id = $1 AND NOT archived ORDER BY semester, name`,
    [programId]
  );

  const resultado: PendientesPrograma['asignaturas'] = [];

  for (const subject of asignaturas) {
    const filas = await query<MatrixCell>('SELECT * FROM matrix_cells WHERE subject_id = $1', [subject.id]);
    const celdas: Record<string, MatrixCell> = {};
    for (const fila of filas) celdas[fila.step_path] = fila;

    const visibles = pasosVisibles(excluirInstanciasExtraSinUsar(buildStepPaths(subject.credits), celdas), celdas);
    const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;

    resultado.push({
      subject,
      avance: {
        terminados,
        total: visibles.length,
        porcentaje: visibles.length ? Math.round((terminados / visibles.length) * 100) : 100,
      },
      pendientes: visibles
        .filter((p) => celdas[p.path]?.status !== 'terminado')
        .map((p) => ({ ...p, celda: celdas[p.path] ?? null })),
    });
  }

  const respuesta: PendientesPrograma = { programa, asignaturas: resultado };
  res.json(respuesta);
});
