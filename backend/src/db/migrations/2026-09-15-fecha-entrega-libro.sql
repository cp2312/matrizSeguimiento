-- ============================================================================
--  Migración: fecha tentativa de entrega del libro
--  Fecha: 2026-09-15
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega, por asignatura (solo se entrega un libro por
--  asignatura, no uno por docente), la fecha en que los docentes dijeron que
--  iban a entregar el libro, más la columna que evita reenviar el mismo
--  aviso una y otra vez (ver backend/src/lib/bookWarnings.ts).
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS book_due_date DATE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS book_due_warning_sent_at TIMESTAMPTZ;
