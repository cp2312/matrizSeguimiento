-- ============================================================================
--  Migración: foto de perfil (avatar) de cada usuario
--  Fecha: 2026-09-08
--
--  Agrega a users una columna avatar_url que guarda la foto de perfil como
--  data URL base64 (data:image/png;base64,...) o NULL si no hay foto. Se
--  guarda en la base (no en el file system) para que un despliegue no dependa
--  de disco local ni de servir estáticos.
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;