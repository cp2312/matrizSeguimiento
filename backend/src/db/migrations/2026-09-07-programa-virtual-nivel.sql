-- ============================================================================
--  Migración: nivel académico (pregrado/posgrado) de un programa virtual
--  Fecha: 2026-09-07
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace:
--    Agrega a programs si es de pregrado o posgrado -- solo aplica cuando
--    type es 'virtual'. Se valida en el backend (routes/programs.ts), no con
--    un CHECK, para no romper programas virtuales que ya existan sin este
--    dato todavía.
--
--  Seguro de correr más de una vez (IF NOT EXISTS / DO $$ ... $$).
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE program_level AS ENUM ('pregrado', 'posgrado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE programs ADD COLUMN IF NOT EXISTS academic_level program_level;
