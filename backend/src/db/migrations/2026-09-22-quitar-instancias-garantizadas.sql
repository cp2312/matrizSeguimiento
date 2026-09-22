-- ============================================================================
--  Migración: quitar instancias garantizadas por créditos (OVA, Video de
--  contenido, Guía, Podcast, Infografía...) que al final no se hacen
--  Fecha: 2026-09-22
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega subject_removed_instances -- ver el comentario de la
--  tabla en schema.sql para el detalle de por qué hace falta una tabla
--  aparte (no alcanza con borrar las celdas de matrix_cells).
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS subject_removed_instances (
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  block_key  TEXT    NOT NULL,
  instance   INTEGER NOT NULL,

  removed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  PRIMARY KEY (subject_id, block_key, instance)
);

COMMENT ON TABLE subject_removed_instances IS 'Instancias garantizadas por creditos que el equipo marco como "no aplica" para una asignatura puntual';

CREATE INDEX IF NOT EXISTS idx_removed_instances_subject ON subject_removed_instances(subject_id);
