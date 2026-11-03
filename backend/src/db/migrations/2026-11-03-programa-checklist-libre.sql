-- ============================================================================
--  Migración: checklist de particularidades del programa, de 3 casillas fijas
--  a una lista libre de texto
--  Fecha: 2026-11-03
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace:
--    Las tres columnas booleanas (sin_porcentaje_guias,
--    sin_actividades_colaborativas, una_actividad_por_seccion, agregadas en
--    2026-10-20-programa-registro-calificado-y-checklist.sql) solo admitían
--    esos tres ítems fijos. Se reemplazan por una sola columna "checklist"
--    (arreglo de texto) para poder agregar más aspectos al checklist de
--    cualquier programa, sin tener que agregar una columna nueva cada vez.
--
--    Antes de borrar las columnas viejas, migra los valores ya marcados en
--    TRUE de cada programa como ítems de su nuevo "checklist" -- ningún
--    programa pierde lo que ya tenía marcado.
--
--  Seguro de correr más de una vez (IF NOT EXISTS / columnas ya borradas se
--  ignoran).
-- ============================================================================

ALTER TABLE programs ADD COLUMN IF NOT EXISTS checklist TEXT[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'sin_porcentaje_guias'
  ) THEN
    UPDATE programs SET checklist = checklist
      || (CASE WHEN sin_porcentaje_guias THEN ARRAY['Sin porcentaje de guías'] ELSE '{}' END)::TEXT[]
      || (CASE WHEN sin_actividades_colaborativas THEN ARRAY['Sin Actividades Colaborativas'] ELSE '{}' END)::TEXT[]
      || (CASE WHEN una_actividad_por_seccion THEN ARRAY['1 Actividad por Sección'] ELSE '{}' END)::TEXT[]
    WHERE sin_porcentaje_guias OR sin_actividades_colaborativas OR una_actividad_por_seccion;

    ALTER TABLE programs DROP COLUMN sin_porcentaje_guias;
    ALTER TABLE programs DROP COLUMN sin_actividades_colaborativas;
    ALTER TABLE programs DROP COLUMN una_actividad_por_seccion;
  END IF;
END $$;
