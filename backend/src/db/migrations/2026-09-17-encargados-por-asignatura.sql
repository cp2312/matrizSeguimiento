-- ============================================================================
--  Migración: encargado por categoría, propio de cada asignatura
--  Fecha: 2026-09-17
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega la tabla que permite que el encargado de una categoría
--  (p. ej. "Libro") sea distinto en una asignatura que en otra, en vez de
--  ser siempre el mismo encargado global para toda la app (category_owners).
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS subject_category_owners (
  id         SERIAL  PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  category   TEXT    NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_subject_category UNIQUE (subject_id, category)
);

CREATE INDEX IF NOT EXISTS idx_subject_category_owners_subject ON subject_category_owners(subject_id);

DROP TRIGGER IF EXISTS trg_subject_category_owners_touch ON subject_category_owners;
CREATE TRIGGER trg_subject_category_owners_touch BEFORE UPDATE ON subject_category_owners
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
