import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { CATEGORIAS_ENCARGADO } from '../../../shared/types.js';
import type { CategoriaEncargado } from '../../../shared/types.js';

export const subjectEncargadosRouter = Router();

// "jefe" no está atado a un apartado puntual -- no tiene override por asignatura
const CATEGORIAS_POR_ASIGNATURA = Object.entries(CATEGORIAS_ENCARGADO)
  .filter(([key]) => key !== 'jefe')
  .map(([key, label]) => ({ key: key as CategoriaEncargado, label }));

/**
 * Encargados de esta asignatura por categoría: el que se ve en cada apartado
 * relevante (Libro, Tipo de contrato, OVA, Podcast, Video de contenido,
 * Guías, Cuestionario final). Si la asignatura no tiene uno propio, se
 * refleja el global (category_owners) como referencia, sin marcarlo como
 * "propio" -- así el apartado deja claro a quién le va a llegar el correo
 * aunque nadie haya tocado nada acá todavía.
 */
subjectEncargadosRouter.get('/subjects/:id/encargados', async (req, res) => {
  const subjectId = req.params.id;

  const globales = await query<{ category: string; user_id: number | null; full_name: string | null; email: string | null }>(
    `SELECT co.category, co.user_id, u.full_name, u.email
     FROM category_owners co LEFT JOIN users u ON u.id = co.user_id`
  );
  const porCategoriaGlobal = new Map(globales.map((f) => [f.category, f]));

  const propios = await query<{ category: string; user_id: number; full_name: string; email: string }>(
    `SELECT sco.category, sco.user_id, u.full_name, u.email
     FROM subject_category_owners sco JOIN users u ON u.id = sco.user_id
     WHERE sco.subject_id = $1`,
    [subjectId]
  );
  const porCategoriaPropio = new Map(propios.map((f) => [f.category, f]));

  const resultado = CATEGORIAS_POR_ASIGNATURA.map(({ key, label }) => {
    const propio = porCategoriaPropio.get(key);
    const global = porCategoriaGlobal.get(key);
    return {
      category: key,
      label,
      userId: propio?.user_id ?? null,
      userFullName: propio?.full_name ?? null,
      userEmail: propio?.email ?? null,
      esPropio: !!propio,
      globalUserFullName: global?.full_name ?? null,
    };
  });

  res.json(resultado);
});

// Asigna (o quita, con userId null, para volver a usar el global) el
// encargado de una categoría propio de esta asignatura. Solo un
// administrador puede reasignar a quién le llegan los correos.
subjectEncargadosRouter.put('/subjects/:id/encargados/:category', requireAdmin, async (req, res) => {
  const subjectId = req.params.id;
  const { category } = req.params;
  const { userId } = req.body;

  if (!CATEGORIAS_POR_ASIGNATURA.some((c) => c.key === category)) {
    return res.status(404).json({ error: 'Categoría no válida' });
  }

  if (userId) {
    await query(
      `INSERT INTO subject_category_owners (subject_id, category, user_id) VALUES ($1,$2,$3)
       ON CONFLICT (subject_id, category) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = now()`,
      [subjectId, category, userId]
    );
  } else {
    await query('DELETE FROM subject_category_owners WHERE subject_id = $1 AND category = $2', [subjectId, category]);
  }

  res.json({ ok: true });
});
