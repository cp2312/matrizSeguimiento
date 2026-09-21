import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import type { AppSettings } from '../../../shared/types.js';

export const settingsRouter = Router();

// Configuración global (por ahora, solo el link a la matriz en Excel).
// Cualquier usuario con sesión puede leerla -- el acceso rápido en la barra
// de navegación es solo para administradores, pero no hay nada sensible acá.
settingsRouter.get('/settings', async (_req, res) => {
  const fila = await queryOne<{ matriz_excel_url: string | null }>(
    `SELECT matriz_excel_url FROM app_settings WHERE id = 1`
  );
  const resultado: AppSettings = { matrizExcelUrl: fila?.matriz_excel_url ?? null };
  res.json(resultado);
});

settingsRouter.put('/settings', requireAdmin, async (req, res) => {
  const { matrizExcelUrl } = req.body as { matrizExcelUrl?: string | null };
  const valor = typeof matrizExcelUrl === 'string' ? matrizExcelUrl.trim() : '';

  if (valor && !/^https?:\/\/.+/i.test(valor)) {
    return res.status(400).json({ error: 'El link debe empezar con http:// o https://' });
  }

  await query(
    `UPDATE app_settings SET matriz_excel_url = $1, updated_by = $2 WHERE id = 1`,
    [valor || null, req.user!.id]
  );

  const resultado: AppSettings = { matrizExcelUrl: valor || null };
  res.json(resultado);
});
