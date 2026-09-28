-- ============================================================================
--  Migración: copia de seguridad automática antes de "Reiniciar matriz"
--  Fecha: 2026-09-27
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega subject_reset_backups -- justo antes de borrar las
--  celdas y docentes de una asignatura (POST /subjects/:id/reiniciar), se
--  guarda ahí una copia completa (como JSON) para poder revisarla o
--  restaurarla después.
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS subject_reset_backups (
  id         SERIAL  PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,

  celdas   JSONB NOT NULL,
  teachers JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE subject_reset_backups IS 'Copia de celdas y docentes de una asignatura guardada justo antes de "Reiniciar matriz"';

CREATE INDEX IF NOT EXISTS idx_reset_backups_subject ON subject_reset_backups(subject_id, created_at DESC);
