-- ============================================================================
--  Migración: link externo a la matriz de seguimiento en Excel
--  Fecha: 2026-09-21
--
--  Este proyecto no tiene un runner de migraciones -- schema.sql se aplica
--  completo sobre una base vacía. Este archivo es para bases YA existentes.
--
--  Qué hace: agrega app_settings, una tabla de una sola fila para
--  configuración global. Por ahora solo guarda el link a la matriz de
--  seguimiento en Excel que se manejaba antes de esta app, para que el
--  administrador tenga acceso rápido desde el panel.
--
--  Seguro de correr más de una vez (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1,
  matriz_excel_url TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT chk_app_settings_fila_unica CHECK (id = 1)
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_app_settings_touch ON app_settings;
CREATE TRIGGER trg_app_settings_touch BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
