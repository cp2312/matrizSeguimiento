-- ============================================================================
--  Migración: fecha límite calculada sola en "Envío para ajustes de experto"
--  Fecha: 2026-09-07
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace:
--    1. Agrega a matrix_cells la fecha inicial de la que sale la fecha
--       límite calculada sola de un paso (ver StepDef.autoDueDate en
--       shared/pipelineTemplate.ts, shared/businessDays.ts).
--    2. Agrega "libro" como categoría con encargado propio -- se asigna
--       desde Usuarios igual que las demás. A ese encargado se le avisa por
--       correo si "Envío para ajustes de experto" no se marca como terminado
--       dentro de los 4 días hábiles siguientes a la fecha de envío.
--
--  Seguro de correr más de una vez (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

ALTER TABLE matrix_cells ADD COLUMN IF NOT EXISTS reference_date DATE;

INSERT INTO category_owners (category) VALUES ('libro')
ON CONFLICT (category) DO NOTHING;
