-- ============================================================================
--  Migración: aviso por correo de contrato próximo a vencer
--  Fecha: 2026-09-05
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega la columna que evita reenviar el mismo aviso una y otra
--  vez (ver backend/src/lib/contractWarnings.ts).
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE subject_teachers ADD COLUMN IF NOT EXISTS contract_warning_sent_at TIMESTAMPTZ;
