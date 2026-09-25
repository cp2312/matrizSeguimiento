-- ============================================================================
--  MATRIZ DE SEGUIMIENTO A PROFESORES
--  Esquema completo â€” PostgreSQL
--
--  Orden de creacion:
--    1. Tipos enumerados
--    2. Funcion de trigger compartida
--    3. Tablas (users -> programs -> subjects -> matrix_cells -> cell_history)
--    4. Indices
--    5. Triggers
--    6. Vistas de consulta
--
--  Este archivo es idempotente en su mayoria: puede ejecutarse sobre una base
--  vacia. Para reconstruir desde cero, usar reset.sql primero.
-- ============================================================================


-- ============================================================================
--  1. TIPOS ENUMERADOS
-- ============================================================================

-- Estados de una celda del proceso.
-- Corresponden uno a uno con la leyenda de colores del Excel original.
--
--   vacio             gris tenue                  el paso aun no se ha iniciado
--   pendiente_equipo  casilla blanca, sub. rojo   pendiente de alguien del equipo
--   pendiente_jefe    casilla amarilla, sub. rojo pendiente para la jefe
--   ajustes           casilla amarilla, sub.negro recurso devuelto para ajustes
--   terminado         fondo verde, letra negra    proceso cerrado
--   por_revisar       fondo blanco, letra negra   pendiente de revision
--
CREATE TYPE cell_status AS ENUM (
  'vacio',
  'pendiente_equipo',
  'pendiente_jefe',
  'ajustes',
  'terminado',
  'por_revisar'
);

-- Roles de acceso a la aplicacion.
-- OJO: esto es distinto de los estados de arriba. El rol define que puede
-- hacer una persona dentro del sistema; el estado describe en que va el
-- trabajo. Un usuario normal puede marcar una celda como 'pendiente_jefe'.
CREATE TYPE user_role AS ENUM (
  'usuario',
  'administrador'
);

-- Modalidad de la asignatura. Solo se usa cuando el programa es hibrido
-- (pregrados que tienen asignaturas presenciales y virtuales a la vez).
CREATE TYPE subject_modality AS ENUM (
  'presencial',
  'virtual'
);

-- Tipo de un programa academico.
--   presencial: mayormente presencial, pero admite asignaturas puntuales en
--               modalidad virtual; esas asignaturas llevan el nombre del
--               programa asociado (ver subjects.hybrid_program_label), sin
--               eleccion de modalidad por asignatura.
--   virtual:    todo el programa es virtual, sin eleccion por asignatura.
--   hibrido:    tiene asignaturas presenciales y virtuales por igual; cada
--               asignatura elige su propia modalidad (ver subject_modality),
--               pero no lleva nombre de programa.
CREATE TYPE program_type AS ENUM (
  'hibrido',
  'presencial',
  'virtual'
);

-- Nivel academico de un programa virtual (pregrado o posgrado). Los otros
-- tipos de programa no lo piden -- ver programs.academic_level.
CREATE TYPE program_level AS ENUM (
  'pregrado',
  'posgrado'
);


-- ============================================================================
--  2. FUNCION DE TRIGGER COMPARTIDA
-- ============================================================================

-- Mantiene updated_at al dia sin que la aplicacion tenga que acordarse.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
--  3. TABLAS
-- ============================================================================

-- ----------------------------------------------------------------------------
--  users
--  Quienes entran al sistema. Las iniciales de esta tabla son las que quedan
--  registradas automaticamente en cada paso del proceso que la persona marca.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  -- No es UNIQUE a propósito: dos personas distintas pueden compartir
  -- iniciales (p. ej. dos "JM"). Lo que sí identifica a cada quien sin
  -- ambigüedad es el id (users.id / matrix_cells.updated_by) -- initials es
  -- solo lo que se estampa en pantalla en cada paso del proceso.
  initials      TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'usuario',
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Foto de perfil como data URL base64 (data:image/...). NULL = sin foto.
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- "Olvidé mi contraseña": token de un solo uso enviado por correo. Se
  -- guarda solo el hash SHA-256 del token (nunca el token en claro) para que
  -- un volcado de la tabla no alcance para restablecer una cuenta. NULL
  -- cuando no hay un restablecimiento pendiente.
  reset_token_hash       TEXT,
  reset_token_expires_at TIMESTAMPTZ,

  CONSTRAINT chk_initials_formato CHECK (initials ~ '^[A-ZÃ‘]{2,4}$'),
  CONSTRAINT chk_email_formato    CHECK (email LIKE '%_@_%._%')
);

COMMENT ON TABLE  users            IS 'Personas con acceso al sistema';
COMMENT ON COLUMN users.initials   IS 'Iniciales que se estampan en cada paso del proceso';
COMMENT ON COLUMN users.role       IS 'usuario: marca avances. administrador: ademas gestiona programas, asignaturas y usuarios';
COMMENT ON COLUMN users.reset_token_hash IS 'Hash SHA-256 del token de recuperacion de contraseña vigente (NULL si no hay ninguno)';


-- ----------------------------------------------------------------------------
--  programs
--  Un programa academico. Es el contenedor de todo.
-- ----------------------------------------------------------------------------
CREATE TABLE programs (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  notes      TEXT,
  type       program_type NOT NULL DEFAULT 'presencial',
  -- Pregrado o posgrado -- solo aplica cuando type es 'virtual'. Se valida en
  -- el backend (routes/programs.ts), no con un CHECK, para no romper
  -- programas virtuales ya existentes al agregar esta columna.
  academic_level program_level,
  archived   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_program_name_no_vacio CHECK (length(trim(name)) > 0)
);

COMMENT ON COLUMN programs.notes     IS 'Notas de especificaciones del programa';
COMMENT ON COLUMN programs.type      IS 'hibrido, presencial o virtual -- hibrido pide modalidad por asignatura; presencial (con asignatura virtual) pide el nombre del programa';
COMMENT ON COLUMN programs.academic_level IS 'Pregrado o posgrado, solo cuando type es virtual';
COMMENT ON COLUMN programs.archived  IS 'Se oculta de la vista principal sin borrar el historico';


-- ----------------------------------------------------------------------------
--  subjects
--  Una asignatura. Equivale a una fila de la matriz del Excel.
--  Aqui van los datos propios de la asignatura, NO los pasos del proceso.
-- ----------------------------------------------------------------------------
CREATE TABLE subjects (
  id         SERIAL  PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,

  -- Identificacion
  semester         TEXT     NOT NULL,
  name             TEXT     NOT NULL,
  book_name        TEXT,
  credits          SMALLINT NOT NULL DEFAULT 1,

  -- Solo aplica cuando el programa es hibrido
  modality             subject_modality,
  -- Solo aplica cuando el programa es presencial (con asignatura virtual)
  hybrid_program_label TEXT,

  -- Firma de derechos y registro DN/DA
  rights_email_date DATE,

  -- Observaciones generales de la asignatura
  general_comment TEXT,

  -- Cuando los hace un profesor en vez del equipo de producciÃ³n, los bloques
  -- de video se muestran como "Video tutorial" en toda la interfaz.
  videos_por_docente BOOLEAN NOT NULL DEFAULT FALSE,

  -- Fecha tentativa (dada por los docentes) de entrega del libro -- una sola
  -- por asignatura, no una por docente, porque solo se entrega un libro. Si
  -- llega esa fecha y "RecepciÃ³n de libro" todavÃ­a no estÃ¡ en 'terminado',
  -- se avisa por correo al encargado de "Libro" (ver bookWarnings.ts).
  book_due_date             DATE,
  book_due_warning_sent_at  TIMESTAMPTZ,

  -- Cuando se avisó (por última vez) que esta asignatura quedó 100%
  -- completa. NULL = todavía no se avisó (o se reabrió algún paso desde el
  -- último aviso, lo que rehabilita el próximo). Ver completionEmail.ts.
  completion_email_sent_at TIMESTAMPTZ,

  archived   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_subject_name_no_vacio CHECK (length(trim(name)) > 0),

  -- De los creditos depende cuantas OVAs, videos y guias se generan.
  -- Maximo 5, que coincide con el tope de recursos por asignatura.
  CONSTRAINT chk_creditos_rango CHECK (credits BETWEEN 1 AND 5),

  -- Una misma asignatura no se repite dentro del mismo semestre y modalidad
  CONSTRAINT uq_asignatura_por_semestre
    UNIQUE (program_id, semester, name, modality)
);

COMMENT ON COLUMN subjects.name                 IS 'Espacio academico';
COMMENT ON COLUMN subjects.book_name            IS 'Se llena solo cuando el libro NO comparte nombre con la asignatura';
COMMENT ON COLUMN subjects.credits              IS 'De 1 a 5. Define cuantas OVAs, videos de contenido y guias se generan: 1 por credito';
COMMENT ON COLUMN subjects.hybrid_program_label IS 'Nombre del programa asociado; solo en programas presenciales con asignatura virtual';
COMMENT ON COLUMN subjects.rights_email_date    IS 'Fecha de envio de correos de firma de derechos';
COMMENT ON COLUMN subjects.book_due_date        IS 'Fecha tentativa (dada por los docentes) de entrega del libro';


-- ----------------------------------------------------------------------------
--  subject_teachers
--  Los docentes o autores de una asignatura. Cuando son varios, cada uno
--  tiene su propia vigencia de contrato (inicio/fin) y su propio tipo de
--  contrato -- eso no se comparte a nivel de asignatura.
-- ----------------------------------------------------------------------------
CREATE TABLE subject_teachers (
  id         SERIAL  PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,

  full_name TEXT NOT NULL,

  -- Vigencia del contrato de este docente
  start_date DATE,
  end_date   DATE,

  contract_type TEXT,

  -- CuÃ¡ndo se avisÃ³ por Ãºltima vez que este contrato estÃ¡ por vencer y la
  -- matriz todavÃ­a tiene pendientes. NULL = no se ha avisado (o se volviÃ³ a
  -- habilitar el aviso porque cambiÃ³ la fecha de fin). Evita reenviar el
  -- mismo aviso una y otra vez.
  contract_warning_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_teacher_name_no_vacio CHECK (length(trim(full_name)) > 0),

  -- El contrato no puede terminar antes de empezar
  CONSTRAINT chk_teacher_fechas_contrato CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  )
);

COMMENT ON TABLE  subject_teachers                IS 'Docentes o autores de una asignatura, con su propia vigencia y tipo de contrato';
COMMENT ON COLUMN subject_teachers.full_name      IS 'Nombre del docente o autor';
COMMENT ON COLUMN subject_teachers.start_date     IS 'Inicio de contrato de este docente';
COMMENT ON COLUMN subject_teachers.end_date       IS 'Fin de contrato de este docente';
COMMENT ON COLUMN subject_teachers.contract_type  IS 'Tipo de contrato de este docente, ej: Prestacion de servicios';


-- ----------------------------------------------------------------------------
--  matrix_cells
--  El corazon del sistema. Una fila por cada paso del proceso de cada
--  asignatura. En lugar de ~90 columnas fijas, cada paso es una fila
--  identificada por step_path.
--
--  Formato de step_path:
--    bloque.paso              -> 'libro.turnitin_repositorio'
--    bloque.instancia.paso    -> 'ovas.2.creacion_guion'
--
--  La estructura del proceso (que pasos existen, cuales llevan comentario
--  obligatorio, donde se bifurca) NO vive aqui: vive en shared/pipelineTemplate.ts.
--  Esta tabla solo guarda los valores.
-- ----------------------------------------------------------------------------
CREATE TABLE matrix_cells (
  id         SERIAL  PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  step_path  TEXT    NOT NULL,

  -- Los tres datos que lleva todo paso desde firma de derechos en adelante
  status    cell_status NOT NULL DEFAULT 'vacio',
  done_date DATE,
  initials  TEXT,

  -- Texto libre: % de Turnitin, fecha del reporte, observaciones de prorroga.
  -- Que comentarios son obligatorios lo valida el backend con la plantilla.
  comment TEXT,

  -- Segundo campo de texto libre, para pasos que necesitan anotar dos datos a
  -- la vez (p. ej. % de Turnitin y % de IA en el reporte de Turnitin del libro).
  second_comment TEXT,

  -- Solo para pasos de decision del tipo "hay ajustes?".
  -- TRUE / FALSE / NULL (aun sin decidir). Con esto el frontend decide si
  -- muestra u oculta los pasos de solicitud y validacion de ajustes.
  branch_value BOOLEAN,

  -- Solo para pasos con StepDef.hasDueDate (creacion_guion de OVA/Podcast/
  -- Video de contenido, recepcion_experto de Guias): fecha limite objetivo,
  -- independiente de si el paso ya esta terminado. Cuando esta por vencer y
  -- el paso todavia no esta en 'terminado', se avisa por correo al
  -- encargado de esa categoria (ver backend/src/lib/dueDateWarnings.ts).
  due_date                 DATE,
  due_date_warning_sent_at TIMESTAMPTZ,

  -- Solo para pasos con StepDef.autoDueDate (Libro: "Envío para ajustes de
  -- experto"): fecha inicial a partir de la cual el backend calcula due_date
  -- solo (sumando días hábiles) -- ver shared/businessDays.ts.
  reference_date DATE,

  -- Nota libre de quién quedó a cargo mientras el paso está "En proceso" --
  -- sin relación con category_owners/subject_category_owners (el encargado
  -- por categoría, que sí dispara avisos por correo). Solo un registro
  -- visible en el panel del paso.
  assigned_note TEXT,

  -- Optimistic locking: cada guardado incrementa version y el backend rechaza
  -- los saves cuya version enviada no coincida con la actual (ver matrix.ts).
  version    INTEGER NOT NULL DEFAULT 1,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- No pueden existir dos filas para el mismo paso de la misma asignatura.
  -- Ademas habilita el INSERT ... ON CONFLICT que usa el backend.
  CONSTRAINT uq_celda_por_asignatura UNIQUE (subject_id, step_path),

  CONSTRAINT chk_step_path_formato CHECK (step_path ~ '^[a-z_]+(\.[0-9]+)?\.[a-z_]+$'),

  -- Un paso no se puede cerrar sin registrar quien y cuando
  CONSTRAINT chk_terminado_completo CHECK (
    status <> 'terminado'
    OR (done_date IS NOT NULL AND initials IS NOT NULL)
  )
);

COMMENT ON TABLE  matrix_cells              IS 'Una fila por paso del proceso por asignatura';
COMMENT ON COLUMN matrix_cells.step_path    IS 'Ruta del paso, ej: libro.turnitin_repositorio u ovas.2.creacion_guion';
COMMENT ON COLUMN matrix_cells.branch_value IS 'Solo en pasos de decision: hay ajustes? TRUE/FALSE/NULL';


-- ----------------------------------------------------------------------------
--  cell_history
--  Auditoria. Cada cambio de estado deja rastro para poder responder
--  "quien marco esto como terminado y cuando".
--  Se llena sola por trigger; la aplicacion no escribe aqui.
-- ----------------------------------------------------------------------------
CREATE TABLE cell_history (
  id         SERIAL  PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  step_path  TEXT    NOT NULL,

  old_status cell_status,
  new_status cell_status NOT NULL,
  old_comment TEXT,
  new_comment TEXT,

  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cell_history IS 'Bitacora automatica de cambios en las celdas del proceso';


-- ----------------------------------------------------------------------------
--  subject_removed_instances
--  Instancias GARANTIZADAS por creditos (p. ej. "OVA 1" con 1 credito) que el
--  equipo marco como "no aplica" para esta asignatura puntual -- a veces no
--  se hacen aunque los creditos digan que corresponden. A diferencia de una
--  instancia EXTRA de un bloque extensible (que se oculta sola en cuanto no
--  tiene celdas, ver excluirInstanciasExtraSinUsar), una instancia
--  garantizada sigue generandose siempre por shared/pipelineTemplate.ts, asi
--  que hace falta guardar aparte cuales se quitaron a mano para que dejen de
--  contar en el avance (ver excluirInstanciasQuitadas). Quitar sus celdas de
--  matrix_cells no alcanza por si solo -- sin esta tabla, volverian a
--  aparecer vacias la proxima vez que se cargue la asignatura.
-- ----------------------------------------------------------------------------
CREATE TABLE subject_removed_instances (
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  block_key  TEXT    NOT NULL,
  instance   INTEGER NOT NULL,

  removed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  PRIMARY KEY (subject_id, block_key, instance)
);

COMMENT ON TABLE subject_removed_instances IS 'Instancias garantizadas por creditos que el equipo marco como "no aplica" para una asignatura puntual';


-- ----------------------------------------------------------------------------
--  category_owners
--  A quien se le avisa por correo cuando un paso de esa categoria del
--  proceso queda pendiente. Una fila fija por categoria monitoreada; el
--  administrador elige el usuario desde la pantalla de Usuarios.
-- ----------------------------------------------------------------------------
CREATE TABLE category_owners (
  category   TEXT PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  category_owners          IS 'Encargado por categoria del proceso que recibe el correo de aviso cuando algo queda pendiente';
COMMENT ON COLUMN category_owners.category IS 'Clave del bloque del proceso (contrato, podcast, cuestionario_final, guias, ovas, video_contenido), o "jefe" (avisa de cualquier "Pendiente jefe", no es un bloque)';

CREATE TRIGGER trg_category_owners_touch BEFORE UPDATE ON category_owners
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Categorias monitoreadas por el aviso de correo. Si se agrega una nueva,
-- basta con insertarla aqui -- el backend valida contra esta tabla.
-- "jefe" es especial: no es un bloque del proceso, es a quien se le avisa
-- de CUALQUIER paso que quede en "Pendiente jefe".
INSERT INTO category_owners (category) VALUES
  ('contrato'), ('podcast'), ('cuestionario_final'), ('guias'), ('ovas'), ('video_contenido'), ('libro'), ('jefe')
ON CONFLICT (category) DO NOTHING;


-- ----------------------------------------------------------------------------
--  subject_category_owners
--  El encargado de una categoria puede variar de una asignatura a otra (una
--  persona distinta a cargo de "Libro" en un programa que en otro). Una fila
--  aca para (asignatura, categoria) pisa al encargado global de esa categoria
--  solo para esa asignatura; si no hay fila, se usa el de category_owners.
--  "jefe" no aplica aca -- no esta atado a un apartado puntual.
-- ----------------------------------------------------------------------------
CREATE TABLE subject_category_owners (
  id         SERIAL  PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  category   TEXT    NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_subject_category UNIQUE (subject_id, category)
);

COMMENT ON TABLE subject_category_owners IS 'Encargado de una categoria, propio de una asignatura -- pisa al encargado global de category_owners solo para esa asignatura';

CREATE TRIGGER trg_subject_category_owners_touch BEFORE UPDATE ON subject_category_owners
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ----------------------------------------------------------------------------
--  app_settings
--  Configuracion global de la app, una sola fila (id fijo en 1). Por ahora
--  solo guarda el link externo a la matriz de seguimiento en Excel que se
--  manejaba antes de esta app, para que el administrador tenga acceso rapido.
-- ----------------------------------------------------------------------------
CREATE TABLE app_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1,
  matriz_excel_url TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT chk_app_settings_fila_unica CHECK (id = 1)
);

COMMENT ON TABLE  app_settings                  IS 'Configuracion global de la app -- una sola fila';
COMMENT ON COLUMN app_settings.matriz_excel_url IS 'Link externo a la matriz de seguimiento en Excel que se manejaba antes';

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_app_settings_touch BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ============================================================================
--  4. INDICES
-- ============================================================================

CREATE INDEX idx_users_email       ON users(email) WHERE active;
CREATE INDEX idx_users_reset_token ON users(reset_token_hash) WHERE reset_token_hash IS NOT NULL;
CREATE INDEX idx_programs_activos  ON programs(archived, name);
CREATE INDEX idx_subjects_program  ON subjects(program_id) WHERE NOT archived;
CREATE INDEX idx_subjects_semestre ON subjects(program_id, semester);
CREATE INDEX idx_subject_teachers_subject ON subject_teachers(subject_id);
CREATE INDEX idx_subject_category_owners_subject ON subject_category_owners(subject_id);

-- El indice mas usado: traer toda la matriz de una asignatura
CREATE INDEX idx_cells_subject ON matrix_cells(subject_id);

-- Para los tableros de pendientes
CREATE INDEX idx_cells_status  ON matrix_cells(status) WHERE status <> 'vacio';

-- Para consultar el historial mas reciente de una asignatura
CREATE INDEX idx_history_subject ON cell_history(subject_id, changed_at DESC);

-- Para traer las instancias quitadas de una asignatura (o de todas las de un programa, por JOIN)
CREATE INDEX idx_removed_instances_subject ON subject_removed_instances(subject_id);


-- ============================================================================
--  5. TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_users_touch    BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_programs_touch BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_subjects_touch BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_subject_teachers_touch BEFORE UPDATE ON subject_teachers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_cells_touch    BEFORE UPDATE ON matrix_cells
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- Registra en cell_history cualquier cambio de estado o de comentario.
CREATE OR REPLACE FUNCTION log_cell_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO cell_history (subject_id, step_path, old_status, new_status, new_comment, changed_by)
    VALUES (NEW.subject_id, NEW.step_path, NULL, NEW.status, NEW.comment, NEW.updated_by);

  ELSIF (NEW.status IS DISTINCT FROM OLD.status
      OR NEW.comment IS DISTINCT FROM OLD.comment
      OR NEW.second_comment IS DISTINCT FROM OLD.second_comment) THEN
    INSERT INTO cell_history (subject_id, step_path, old_status, new_status, old_comment, new_comment, changed_by)
    VALUES (NEW.subject_id, NEW.step_path, OLD.status, NEW.status, OLD.comment, NEW.comment, NEW.updated_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cells_historial
  AFTER INSERT OR UPDATE ON matrix_cells
  FOR EACH ROW EXECUTE FUNCTION log_cell_change();


-- Impide que una asignatura de un programa NO hibrido tenga modalidad.
-- Esta validacion cruza dos tablas, por eso va en trigger y no en CHECK.
CREATE OR REPLACE FUNCTION validar_modalidad_asignatura()
RETURNS TRIGGER AS $$
DECLARE
  tipo_programa program_type;
BEGIN
  SELECT type INTO tipo_programa FROM programs WHERE id = NEW.program_id;

  IF tipo_programa <> 'hibrido' AND NEW.modality IS NOT NULL THEN
    RAISE EXCEPTION 'La modalidad solo aplica en programas hibridos';
  END IF;

  IF tipo_programa = 'hibrido' AND NEW.modality IS NULL THEN
    RAISE EXCEPTION 'Los programas hibridos requieren indicar la modalidad';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subjects_modalidad
  BEFORE INSERT OR UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION validar_modalidad_asignatura();


-- ============================================================================
--  6. VISTAS DE CONSULTA
-- ============================================================================

-- Avance por asignatura.
-- OJO: total_pasos_registrados cuenta solo las celdas que existen en la base,
-- no el total real del proceso. El total real depende de los creditos y lo
-- calcula el backend desde la plantilla. El porcentaje definitivo se arma alla.
CREATE VIEW v_avance_asignaturas AS
SELECT
  s.id                AS subject_id,
  s.program_id,
  p.name              AS programa,
  s.semester          AS semestre,
  s.name              AS asignatura,
  s.credits           AS creditos,
  COUNT(c.id)                                              AS pasos_registrados,
  COUNT(c.id) FILTER (WHERE c.status = 'terminado')        AS terminados,
  COUNT(c.id) FILTER (WHERE c.status = 'ajustes')          AS en_ajustes,
  COUNT(c.id) FILTER (WHERE c.status = 'pendiente_jefe')   AS pendientes_jefe,
  COUNT(c.id) FILTER (WHERE c.status = 'pendiente_equipo') AS pendientes_equipo,
  COUNT(c.id) FILTER (WHERE c.status = 'por_revisar')    AS por_revisar,
  MAX(c.updated_at)                                        AS ultimo_movimiento
FROM subjects s
JOIN programs p        ON p.id = s.program_id
LEFT JOIN matrix_cells c ON c.subject_id = s.id
WHERE NOT s.archived
GROUP BY s.id, s.program_id, p.name, s.semester, s.name, s.credits;


-- Bandeja de pendientes: todo lo que no esta cerrado, con su responsable.
CREATE VIEW v_pendientes AS
SELECT
  p.name     AS programa,
  s.semester AS semestre,
  s.name     AS asignatura,
  c.step_path,
  c.status,
  c.done_date,
  c.initials,
  c.comment,
  c.updated_at,
  u.full_name AS actualizado_por,
  c.second_comment
FROM matrix_cells c
JOIN subjects s      ON s.id = c.subject_id
JOIN programs p      ON p.id = s.program_id
LEFT JOIN users u    ON u.id = c.updated_by
WHERE c.status IN ('pendiente_equipo', 'pendiente_jefe', 'ajustes', 'por_revisar')
  AND NOT s.archived
  AND NOT p.archived;