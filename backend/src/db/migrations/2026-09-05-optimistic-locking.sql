-- Agrega columna version a matrix_cells para optimistic locking.
-- Cada guardado incrementa la version; el backend rechaza saves si la
-- version enviada por el cliente no coincide con la actual.

ALTER TABLE matrix_cells
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
