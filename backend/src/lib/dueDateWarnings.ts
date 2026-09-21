import { query } from '../db/pool.js';
import { enviarAvisoFechaLimite } from './mailer.js';
import { obtenerEncargado } from './encargados.js';
import { findStepDef, etiquetaPaso, parseStepPath } from '../../../shared/pipelineTemplate.js';

/** Con cuántos días de anticipación a la fecha límite se dispara el aviso */
const DIAS_AVISO = 7;

/** Los pasos con StepDef.hasDueDate viven en estos bloques -- cada uno con su propio encargado */
const CATEGORIA_POR_BLOQUE: Record<string, string> = {
  ovas: 'ovas',
  podcast: 'podcast',
  video_contenido: 'video_contenido',
  guias: 'guias',
  libro: 'libro',
};

interface CeldaPorVencer {
  step_path: string;
  due_date: string;
  subject_id: number;
  subject_name: string;
  program_name: string;
}

/** Cuántos días faltan hasta `dueDate` (negativo si ya pasó) */
function diasHasta(dueDate: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${dueDate}T00:00:00`);
  return Math.round((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Revisa todos los pasos con fecha límite (OVA/Podcast/Video de contenido:
 * "Creación de guión"; Guías: "Recepción por experto"; Libro: "Envío para
 * ajustes de experto") que están por vencer (o ya vencieron), todavía no
 * están en 'terminado' y a los que no se les avisó, y le avisa por correo al
 * encargado de esa categoría. Se corre periódicamente (ver index.ts) --
 * nunca lanza.
 */
export async function revisarFechasLimite(): Promise<void> {
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_AVISO);
    const limiteStr = limite.toISOString().slice(0, 10);

    const candidatas = await query<CeldaPorVencer>(
      `SELECT c.step_path, c.due_date, s.id AS subject_id, s.name AS subject_name, p.name AS program_name
       FROM matrix_cells c
       JOIN subjects s ON s.id = c.subject_id
       JOIN programs p ON p.id = s.program_id
       WHERE c.due_date IS NOT NULL
         AND c.due_date <= $1
         AND c.due_date_warning_sent_at IS NULL
         AND c.status <> 'terminado'
         AND NOT s.archived
         AND NOT p.archived`,
      [limiteStr]
    );

    if (!candidatas.length) return;

    for (const c of candidatas) {
      const { blockKey } = parseStepPath(c.step_path);
      const categoria = CATEGORIA_POR_BLOQUE[blockKey];
      if (!categoria) continue; // step_path con hasDueDate fuera de estos 4 bloques: no debería pasar, pero por si acaso

      // El encargado propio de ESTA asignatura para la categoría gana sobre
      // el global -- distinto según la asignatura, no una sola vez para todas.
      const encargado = await obtenerEncargado(categoria, c.subject_id);
      if (!encargado) {
        console.warn(`[fechas-limite] Nadie asignado como encargado de "${categoria}" en la asignatura ${c.subject_id} -- se omite el aviso`);
        continue;
      }

      const def = findStepDef(c.step_path);
      if (!def) continue;

      // Un paso con StepDef.autoDueDate (fecha límite calculada sola, no
      // escrita a mano) solo avisa una vez que esa fecha límite YA venció --
      // a diferencia de los demás, que avisan con DIAS_AVISO de anticipación.
      // Si no, avisarían casi de inmediato: su ventana entera son unos pocos
      // días hábiles, siempre menor a DIAS_AVISO.
      if (def.step.autoDueDate && diasHasta(c.due_date) > 0) continue;

      const { instance } = parseStepPath(c.step_path);

      await enviarAvisoFechaLimite({
        paraEmail: encargado.email,
        paraNombre: encargado.full_name,
        categoria: def.block.label,
        paso: etiquetaPaso(def.step, instance),
        asignatura: `${c.subject_name} (${c.program_name})`,
        dueDate: c.due_date,
        diasRestantes: diasHasta(c.due_date),
        subjectId: c.subject_id,
        apartado: instance ? `${blockKey}.${instance}` : blockKey,
      });

      await query(
        'UPDATE matrix_cells SET due_date_warning_sent_at = now() WHERE subject_id = $1 AND step_path = $2',
        [c.subject_id, c.step_path]
      );
    }
  } catch (err) {
    console.error('[fechas-limite] Error revisando fechas límite:', err);
  }
}
