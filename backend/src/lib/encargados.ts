import { queryOne } from '../db/pool.js';

/**
 * Encargado efectivo de una categoría para una asignatura puntual: si esa
 * asignatura tiene su propio encargado para esta categoría (subject_category_owners),
 * ese gana; si no, se usa el encargado global de la categoría (category_owners).
 *
 * "jefe" no tiene override por asignatura -- no está atado a un apartado, así
 * que siempre resuelve contra el global.
 */
export async function obtenerEncargado(
  category: string, subjectId: number
): Promise<{ full_name: string; email: string } | null> {
  if (category !== 'jefe') {
    const propio = await queryOne<{ full_name: string; email: string }>(
      `SELECT u.full_name, u.email FROM subject_category_owners sco
       JOIN users u ON u.id = sco.user_id
       WHERE sco.subject_id = $1 AND sco.category = $2 AND u.active`,
      [subjectId, category]
    );
    if (propio) return propio;
  }

  return queryOne<{ full_name: string; email: string }>(
    `SELECT u.full_name, u.email FROM category_owners co
     JOIN users u ON u.id = co.user_id
     WHERE co.category = $1 AND u.active`,
    [category]
  );
}
