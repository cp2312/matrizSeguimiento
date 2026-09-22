import { query } from '../db/pool.js';

/**
 * Instancias garantizadas por créditos (p. ej. "OVA 1" con 1 crédito) que el
 * equipo marcó como "no aplica" para esta asignatura puntual -- ver
 * subject_removed_instances y shared/pipelineTemplate.ts (excluirInstanciasQuitadas).
 * Claves "bloque.instancia".
 */
export async function cargarQuitadas(subjectId: number | string): Promise<Set<string>> {
  const filas = await query<{ block_key: string; instance: number }>(
    'SELECT block_key, instance FROM subject_removed_instances WHERE subject_id = $1',
    [subjectId]
  );
  return new Set(filas.map((f) => `${f.block_key}.${f.instance}`));
}

/**
 * Igual que cargarQuitadas pero para todas las asignaturas de un programa a
 * la vez (ver /programs/:id/tablero) -- evita una consulta por asignatura.
 */
export async function cargarQuitadasPorPrograma(programId: number | string): Promise<Map<number, Set<string>>> {
  const filas = await query<{ subject_id: number; block_key: string; instance: number }>(
    `SELECT r.subject_id, r.block_key, r.instance FROM subject_removed_instances r
     JOIN subjects s ON s.id = r.subject_id
     WHERE s.program_id = $1`,
    [programId]
  );

  const mapa = new Map<number, Set<string>>();
  for (const f of filas) {
    const set = mapa.get(f.subject_id) ?? new Set<string>();
    set.add(`${f.block_key}.${f.instance}`);
    mapa.set(f.subject_id, set);
  }
  return mapa;
}
