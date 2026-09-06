-- ============================================================================
--  Migración: porcentaje de IA + reintentos de Reporte Turnitin
--  Fecha: 2026-09-01
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes
--  (como la de desarrollo al momento de escribir esto), que ya tenían datos
--  reales cargados en el paso "libro.reporte_turnitin".
--
--  Qué hace:
--    1. Agrega la columna second_comment a matrix_cells (porcentaje de IA,
--       además del porcentaje de Turnitin que ya existía).
--    2. El paso "Reporte Turnitin" sigue viviendo dentro del bloque "Libro"
--       (no es su propio apartado) pero ahora admite hasta 3 intentos, por si
--       hay que repetir la prueba. Su step_path pasó de ser fijo
--       ('libro.reporte_turnitin') a llevar el número de intento en el medio
--       ('libro.1.reporte_turnitin', 'libro.2.reporte_turnitin'...) -- este
--       UPDATE reubica el primer intento ahí sin perder su estado, fecha,
--       iniciales ni el porcentaje ya cargado.
--
--  Seguro de correr más de una vez (todo con guardas IF NOT EXISTS / WHERE).
-- ============================================================================

ALTER TABLE matrix_cells ADD COLUMN IF NOT EXISTS second_comment TEXT;

UPDATE matrix_cells
SET step_path = 'libro.1.reporte_turnitin'
WHERE step_path = 'libro.reporte_turnitin';

-- Por si la vista v_pendientes ya existía sin second_comment (CREATE VIEW no
-- soporta IF NOT EXISTS con columnas nuevas, hay que recrearla)
CREATE OR REPLACE VIEW v_pendientes AS
SELECT
  p.name     AS programa,
  s.semester AS semestre,
  s.name     AS asignatura,
  c.step_path,
  c.status,
  c.done_date,
  c.initials,
  c.comment,
  c.updated_at,
  u.full_name AS actualizado_por,
  c.second_comment
FROM matrix_cells c
JOIN subjects s      ON s.id = c.subject_id
JOIN programs p      ON p.id = s.program_id
LEFT JOIN users u    ON u.id = c.updated_by
WHERE c.status IN ('pendiente_equipo', 'pendiente_jefe', 'ajustes', 'por_revisar')
  AND NOT s.archived
  AND NOT p.archived;

CREATE OR REPLACE FUNCTION log_cell_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO cell_history (subject_id, step_path, old_status, new_status, new_comment, changed_by)
    VALUES (NEW.subject_id, NEW.step_path, NULL, NEW.status, NEW.comment, NEW.updated_by);

  ELSIF (NEW.status IS DISTINCT FROM OLD.status
      OR NEW.comment IS DISTINCT FROM OLD.comment
      OR NEW.second_comment IS DISTINCT FROM OLD.second_comment) THEN
    INSERT INTO cell_history (subject_id, step_path, old_status, new_status, old_comment, new_comment, changed_by)
    VALUES (NEW.subject_id, NEW.step_path, OLD.status, NEW.status, OLD.comment, NEW.comment, NEW.updated_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
