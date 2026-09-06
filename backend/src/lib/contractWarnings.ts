import { query, queryOne } from '../db/pool.js';
import { enviarAvisoContratoPorVencer } from './mailer.js';
import {
  buildStepPaths, pasosVisibles, excluirInstanciasExtraSinUsar,
} from '../../../shared/pipelineTemplate.js';
import type { MatrixCell } from '../../../shared/types.js';

/** Con cuántos días de anticipación al fin del contrato se dispara el aviso */
const DIAS_AVISO = 15;

interface ContratoPorVencer {
  teacher_id: number;
  teacher_name: string;
  end_date: string;
  subject_id: number;
  subject_name: string;
  program_name: string;
  credits: number;
}

/** Cuántos días faltan hasta `endDate` (negativo si ya pasó) */
function diasHasta(endDate: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${endDate}T00:00:00`);
  return Math.round((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Revisa todos los docentes cuyo contrato vence pronto (o ya venció) y a los
 * que todavía no se les avisó, y si la matriz de su asignatura no está al
 * 100%, le avisa por correo al encargado de "Tipo de contrato". Se corre
 * periódicamente (ver index.ts) -- nunca lanza, para no tumbar el proceso
 * si falla un correo o la base.
 */
export async function revisarContratosPorVencer(): Promise<void> {
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_AVISO);
    const limiteStr = limite.toISOString().slice(0, 10);

    const candidatos = await query<ContratoPorVencer>(
      `SELECT t.id AS teacher_id, t.full_name AS teacher_name, t.end_date,
              s.id AS subject_id, s.name AS subject_name, s.credits,
              p.name AS program_name
       FROM subject_teachers t
       JOIN subjects s ON s.id = t.subject_id
       JOIN programs p ON p.id = s.program_id
       WHERE t.end_date IS NOT NULL
         AND t.end_date <= $1
         AND t.contract_warning_sent_at IS NULL
         AND NOT s.archived
         AND NOT p.archived`,
      [limiteStr]
    );

    if (!candidatos.length) return;

    // Si nadie está asignado como encargado de "Tipo de contrato", no hay a
    // quién avisar -- se omite todo el lote (se reintenta en la próxima
    // revisión, ya que contract_warning_sent_at no se toca).
    const encargado = await queryOne<{ full_name: string; email: string }>(
      `SELECT u.full_name, u.email FROM category_owners co
       JOIN users u ON u.id = co.user_id
       WHERE co.category = 'contrato'`
    );
    if (!encargado) {
      console.warn('[contratos] Nadie asignado como encargado de "Tipo de contrato" -- se omiten los avisos');
      return;
    }

    for (const c of candidatos) {
      const filas = await query<MatrixCell>('SELECT * FROM matrix_cells WHERE subject_id = $1', [c.subject_id]);
      const celdas: Record<string, MatrixCell> = {};
      for (const fila of filas) celdas[fila.step_path] = fila;

      const visibles = pasosVisibles(excluirInstanciasExtraSinUsar(buildStepPaths(c.credits), celdas), celdas);
      const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;
      const porcentaje = visibles.length ? Math.round((terminados / visibles.length) * 100) : 100;

      // Ya está completa: no hace falta avisar. No se marca como avisada
      // -- si más adelante se reabre algún paso, se vuelve a revisar en la
      // siguiente corrida en vez de quedar silenciada para siempre.
      if (porcentaje >= 100) continue;

      await enviarAvisoContratoPorVencer({
        paraEmail: encargado.email,
        paraNombre: encargado.full_name,
        docente: c.teacher_name,
        asignatura: c.subject_name,
        programa: c.program_name,
        endDate: c.end_date,
        diasRestantes: diasHasta(c.end_date),
        avancePorcentaje: porcentaje,
        subjectId: c.subject_id,
      });

      await query('UPDATE subject_teachers SET contract_warning_sent_at = now() WHERE id = $1', [c.teacher_id]);
    }
  } catch (err) {
    console.error('[contratos] Error revisando contratos por vencer:', err);
  }
}
