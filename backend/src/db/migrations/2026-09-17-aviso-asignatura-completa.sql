-- ============================================================================
--  Migración: aviso por correo cuando una asignatura queda 100% completa
--  Fecha: 2026-09-17
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega la columna que evita reenviar el mismo aviso de
--  "asignatura completada" una y otra vez (ver backend/src/lib/completionEmail.ts).
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS completion_email_sent_at TIMESTAMPTZ;
