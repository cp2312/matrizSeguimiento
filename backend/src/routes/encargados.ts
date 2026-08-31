import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { CATEGORIAS_ENCARGADO } from '../../../shared/types.js';
import type { CategoriaEncargado, CategoryOwner } from '../../../shared/types.js';

export const encargadosRouter = Router();

const CATEGORIAS = Object.entries(CATEGORIAS_ENCARGADO).map(([key, label]) => ({
  key: key as CategoriaEncargado,
  label,
}));

// Quién es el encargado de cada categoría, para la pantalla de administración
encargadosRouter.get('/encargados', requireAdmin, async (_req, res) => {
  const filas = await query<{ category: string; user_id: number | null; full_name: string | null; email: string | null }>(
    `SELECT co.category, co.user_id, u.full_name, u.email
     FROM category_owners co
     LEFT JOIN users u ON u.id = co.user_id`
  );
  const porCategoria = new Map(filas.map((f) => [f.category, f]));

  const resultado: CategoryOwner[] = CATEGORIAS.map((c) => {
    const fila = porCategoria.get(c.key);
    return {
      category: c.key,
      label: c.label,
      userId: fila?.user_id ?? null,
      userFullName: fila?.full_name ?? null,
      userEmail: fila?.email ?? null,
    };
  });

  res.json(resultado);
});

// Asigna (o quita, con userId null) el encargado de una categoría
encargadosRouter.put('/encargados/:category', requireAdmin, async (req, res) => {
  const { category } = req.params;
  const { userId } = req.body;

  if (!CATEGORIAS.some((c) => c.key === category)) {
    return res.status(404).json({ error: 'Categoría no válida' });
  }

  await query(
    `INSERT INTO category_owners (category, user_id) VALUES ($1, $2)
     ON CONFLICT (category) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [category, userId || null]
  );

  res.json({ ok: true });
});
