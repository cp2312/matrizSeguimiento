import { query, queryOne } from '../db/pool.js';
import { enviarAvisoLibroNoEntregado } from './mailer.js';
import { obtenerEncargado } from './encargados.js';

/** step_path del paso "Recepción de libro" -- no repetible, siempre esta misma ruta */
const PASO_RECEPCION_LIBRO = 'libro.recepcion_libro';

interface FechaEntregaVencida {
  subject_id: number;
  subject_name: string;
  program_name: string;
  book_due_date: string;
}

/** Cuántos días faltan hasta `fecha` (negativo si ya pasó) */
function diasHasta(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${fecha}T00:00:00`);
  return Math.round((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Revisa todas las asignaturas cuya fecha tentativa de entrega del libro ya
 * pasó (y a las que todavía no se les avisó) y, si "Recepción de libro"
 * todavía no está en 'terminado', le avisa por correo al encargado de
 * "Libro" -- una sola fecha por asignatura, no una por docente, porque solo
 * se entrega un libro. Se corre periódicamente (ver index.ts) -- nunca
 * lanza, para no tumbar el proceso si falla un correo o la base.
 */
export async function revisarLibroNoEntregado(): Promise<void> {
  try {
    const hoyStr = new Date().toISOString().slice(0, 10);

    const candidatas = await query<FechaEntregaVencida>(
      `SELECT s.id AS subject_id, s.name AS subject_name, p.name AS program_name, s.book_due_date
       FROM subjects s
       JOIN programs p ON p.id = s.program_id
       WHERE s.book_due_date IS NOT NULL
         AND s.book_due_date <= $1
         AND s.book_due_warning_sent_at IS NULL
         AND NOT s.archived
         AND NOT p.archived`,
      [hoyStr]
    );

    if (!candidatas.length) return;

    for (const c of candidatas) {
      const celda = await queryOne<{ status: string }>(
        `SELECT status FROM matrix_cells WHERE subject_id = $1 AND step_path = $2`,
        [c.subject_id, PASO_RECEPCION_LIBRO]
      );

      // Ya se recibió el libro: no hace falta avisar. No se marca como
      // avisada -- si esto se revisa antes de guardar la celda, en la
      // siguiente corrida se vuelve a chequear en vez de quedar silenciada.
      if (celda?.status === 'terminado') continue;

      // El encargado propio de ESTA asignatura para "Libro" gana sobre el
      // global -- puede ser distinto de una asignatura a otra.
      const encargado = await obtenerEncargado('libro', c.subject_id);
      if (!encargado) {
        console.warn(`[libro] Nadie asignado como encargado de "Libro" en la asignatura ${c.subject_id} -- se omite el aviso`);
        continue;
      }

      const docentes = await query<{ full_name: string }>(
        `SELECT full_name FROM subject_teachers WHERE subject_id = $1 ORDER BY id`,
        [c.subject_id]
      );

      await enviarAvisoLibroNoEntregado({
        paraEmail: encargado.email,
        paraNombre: encargado.full_name,
        docentes: docentes.map((d) => d.full_name).join(', ') || null,
        asignatura: c.subject_name,
        programa: c.program_name,
        bookDueDate: c.book_due_date,
        diasRestantes: diasHasta(c.book_due_date),
        subjectId: c.subject_id,
      });

      await query('UPDATE subjects SET book_due_warning_sent_at = now() WHERE id = $1', [c.subject_id]);
    }
  } catch (err) {
    console.error('[libro] Error revisando fechas de entrega del libro:', err);
  }
}
