-- ============================================================================
--  Migración: registro calificado + checklist de particularidades del programa
--  Fecha: 2026-10-20
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace:
--    - Agrega a programs el número/estado del registro calificado (texto
--      libre, opcional).
--    - Agrega tres casilleros de particularidades del programa frente al
--      proceso estándar (sin_porcentaje_guias, sin_actividades_colaborativas,
--      una_actividad_por_seccion) -- antes vivían como texto suelto dentro de
--      "notes"; pasan a columnas propias para poder mostrarlas como insignia.
--      Los programas existentes quedan todos en FALSE -- hay que
--      re-marcarlos a mano la próxima vez que se editen, no se migra
--      automáticamente el texto libre de "notes" (demasiado frágil parsearlo).
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE programs ADD COLUMN IF NOT EXISTS registro_calificado TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS sin_porcentaje_guias BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS sin_actividades_colaborativas BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS una_actividad_por_seccion BOOLEAN NOT NULL DEFAULT FALSE;
