-- ============================================================================
--  Migración: fecha estimada de apertura de un programa
--  Fecha: 2026-10-06
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega programs.fecha_apertura -- semestre estimado en el que
--  el programa entra en oferta (formato 'AAAA-1' / 'AAAA-2'), para poder
--  priorizar el plan de virtualización en el Dashboard por cercanía a esa
--  fecha. Opcional -- los programas existentes quedan sin ella hasta que se
--  edite cada uno.
--
--  Seguro de correr más de una vez (IF NOT EXISTS / DO NOTHING).
-- ============================================================================

ALTER TABLE programs ADD COLUMN IF NOT EXISTS fecha_apertura TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fecha_apertura_formato'
  ) THEN
    ALTER TABLE programs ADD CONSTRAINT chk_fecha_apertura_formato
      CHECK (fecha_apertura IS NULL OR fecha_apertura ~ '^[0-9]{4}-[12]$');
  END IF;
END $$;

COMMENT ON COLUMN programs.fecha_apertura IS 'Semestre estimado de apertura, formato AAAA-1 / AAAA-2 -- para priorizar el plan de virtualizacion';
