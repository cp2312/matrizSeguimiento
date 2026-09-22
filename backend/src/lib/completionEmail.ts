import { query, queryOne } from '../db/pool.js';
import { enviarAvisoAsignaturaCompleta } from './mailer.js';
import { obtenerEncargado } from './encargados.js';
import { cargarQuitadas } from './removedInstances.js';
import { buildStepPaths, pasosVisibles, pasosAplicables } from '../../../shared/pipelineTemplate.js';
import type { MatrixCell, Subject } from '../../../shared/types.js';

/** step_path del paso "Link aula" -- no repetible, siempre esta misma ruta */
const PASO_LINK_AULA = 'revision_final.link_aula';

/**
 * Revisa si esta asignatura acaba de quedar 100% completa (todos sus pasos
 * visibles en 'terminado') y, si es así y todavía no se avisó, le avisa por
 * correo a la jefe -- con el link del aula virtual si ya se llenó (ver
 * enviarAvisoAsignaturaCompleta). Se llama después de guardar cada celda
 * (ver matrix.ts), no periódicamente -- nunca lanza.
 *
 * Si algún paso se reabre después de haber avisado, se rehabilita el aviso
 * (vuelve a NULL) para la próxima vez que de verdad se complete todo otra
 * vez, en vez de quedar silenciada para siempre.
 */
export async function revisarSiSeCompleto(subjectId: number): Promise<void> {
  try {
    const asignatura = await queryOne<Subject>('SELECT * FROM subjects WHERE id = $1', [subjectId]);
    if (!asignatura || asignatura.archived) return;

    const filas = await query<MatrixCell>('SELECT * FROM matrix_cells WHERE subject_id = $1', [subjectId]);
    const celdas: Record<string, MatrixCell> = {};
    for (const fila of filas) celdas[fila.step_path] = fila;

    const quitadas = await cargarQuitadas(subjectId);
    const visibles = pasosVisibles(pasosAplicables(buildStepPaths(asignatura.credits), celdas, quitadas), celdas);
    const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;
    const completa = visibles.length > 0 && terminados === visibles.length;

    if (!completa) {
      if (asignatura.completion_email_sent_at) {
        await query('UPDATE subjects SET completion_email_sent_at = NULL WHERE id = $1', [subjectId]);
      }
      return;
    }

    if (asignatura.completion_email_sent_at) return; // ya se avisó -- no reenviar

    const encargado = await obtenerEncargado('jefe', subjectId);
    if (!encargado) {
      console.warn(`[completado] Nadie asignado como encargado de "jefe" -- se omite el aviso de finalización de la asignatura ${subjectId}`);
      return;
    }

    const programa = await queryOne<{ name: string }>('SELECT name FROM programs WHERE id = $1', [asignatura.program_id]);

    await enviarAvisoAsignaturaCompleta({
      paraEmail: encargado.email,
      paraNombre: encargado.full_name,
      asignatura: asignatura.name,
      programa: programa?.name ?? '',
      linkAula: celdas[PASO_LINK_AULA]?.comment ?? null,
      subjectId,
    });

    await query('UPDATE subjects SET completion_email_sent_at = now() WHERE id = $1', [subjectId]);
  } catch (err) {
    console.error('[completado] Error revisando si la asignatura se completó:', err);
  }
}
