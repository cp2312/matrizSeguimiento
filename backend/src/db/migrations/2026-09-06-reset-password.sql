-- ============================================================================
--  Migración: recuperación de contraseña por correo
--  Fecha: 2026-09-06
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace:
--    Agrega a users el token de un solo uso para "olvidé mi contraseña" (ver
--    backend/src/routes/auth.ts). Se guarda solo el hash SHA-256 del token,
--    nunca el token en claro -- igual que password_hash, un volcado de la
--    tabla no debe alcanzar para restablecer una cuenta.
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;
