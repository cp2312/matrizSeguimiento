import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Por defecto, node-pg convierte las columnas DATE a un objeto Date de JS, que
// Express serializa a JSON como timestamp completo ("2026-01-15T05:00:00.000Z").
// Eso rompe cualquier <input type="date"> del frontend, que solo acepta
// "YYYY-MM-DD" -- el campo se ve vacío aunque el valor sí esté guardado. Se
// desactiva esa conversión (oid 1082 = tipo "date") para que viaje tal cual
// como string "YYYY-MM-DD", sin pasar por Date ni arriesgar corrimientos de
// zona horaria.
pg.types.setTypeParser(1082, (val) => val);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err);
});


export async function query<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}


export async function queryOne<T = any>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}


/**
 * Corre varias sentencias en una sola transaccion. Si `fn` lanza, se hace
 * ROLLBACK y el error sube tal cual (para que las rutas sigan pudiendo leer
 * err.code como con `query`/`queryOne`).
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}