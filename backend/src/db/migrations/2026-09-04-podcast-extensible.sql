-- ============================================================================
--  Migración: Podcast pasa a ser un bloque extensible
--  Fecha: 2026-09-04
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes
--  (como la de desarrollo al momento de escribir esto), que ya tenían datos
--  reales cargados en pasos de "podcast".
--
--  Qué hace:
--    "Podcast" ahora admite agregar otro a mano si hace falta (igual que OVA
--    y Video de contenido), así que sus step_path pasan a llevar el número
--    de instancia -- de 'podcast.<paso>' a 'podcast.1.<paso>'. Este UPDATE
--    reubica los pasos ya guardados ahí sin perder su estado, fecha,
--    iniciales ni comentarios.
--
--  Seguro de correr más de una vez (el WHERE no vuelve a matchear la
--  segunda vez que se corre).
-- ============================================================================

UPDATE matrix_cells
SET step_path = 'podcast.1.' || split_part(step_path, '.', 2)
WHERE step_path LIKE 'podcast.%' AND step_path NOT LIKE 'podcast.1.%';
