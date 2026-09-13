-- ============================================================================
--  Migración: las iniciales de un usuario ya no tienen que ser únicas
--  Fecha: 2026-09-13
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace:
--    Quita la restricción UNIQUE de users.initials -- dos personas distintas
--    pueden compartir iniciales (p. ej. dos "JM"). Lo que identifica a cada
--    quien sin ambigüedad sigue siendo el id (users.id / matrix_cells.updated_by);
--    initials es solo lo que se estampa en pantalla en cada paso del proceso.
--
--  Seguro de correr más de una vez (DROP CONSTRAINT IF EXISTS).
-- ============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_initials_key;
