-- ============================================================================
--  Migración: nota libre de "quién quedó a cargo" en un paso "En proceso"
--  Fecha: 2026-09-25
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega matrix_cells.assigned_note -- un campo de texto libre,
--  sin relación con el encargado por categoría (category_owners /
--  subject_category_owners, que sí dispara avisos por correo) ni con ningún
--  otro mecanismo de aviso. Solo un registro visible en el panel del paso
--  mientras está "En proceso", para anotar quién quedó siguiéndolo aunque
--  otra persona haya sido quien lo puso en ese estado.
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE matrix_cells ADD COLUMN IF NOT EXISTS assigned_note TEXT;
