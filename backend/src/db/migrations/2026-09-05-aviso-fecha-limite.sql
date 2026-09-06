-- ============================================================================
--  Migración: aviso por correo de fecha límite por vencer (OVA, Podcast,
--  Video de contenido, Guías)
--  Fecha: 2026-09-05
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace:
--    1. Agrega a matrix_cells la fecha límite de un paso y cuándo se avisó
--       por última vez que está por vencer (ver backend/src/lib/dueDateWarnings.ts).
--    2. Agrega "ovas" y "video_contenido" como categorías con encargado
--       propio (antes solo existían para contrato/podcast/cuestionario_final/
--       guias/jefe) -- se asignan desde Usuarios igual que las demás.
--
--  Seguro de correr más de una vez (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

ALTER TABLE matrix_cells ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE matrix_cells ADD COLUMN IF NOT EXISTS due_date_warning_sent_at TIMESTAMPTZ;

INSERT INTO category_owners (category) VALUES
  ('ovas'), ('video_contenido')
ON CONFLICT (category) DO NOTHING;
