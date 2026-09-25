

export type CellStatus =
  | 'vacio'
  | 'pendiente_equipo'
  | 'pendiente_jefe'
  | 'ajustes'
  | 'terminado'
  | 'por_revisar';

export type UserRole = 'usuario' | 'administrador';

export type SubjectModality = 'presencial' | 'virtual';

/**
 * Tipo de un programa.
 *   presencial: mayormente presencial, pero puede tener asignaturas puntuales
 *               en modalidad virtual -- no se elige modalidad por asignatura,
 *               pero cada asignatura lleva el nombre del programa asociado.
 *   virtual:    todo el programa es virtual, sin eleccion por asignatura.
 *   hibrido:    tiene asignaturas presenciales y virtuales por igual; cada
 *               asignatura elige su modalidad, pero no lleva nombre de programa.
 */
export type ProgramType = 'hibrido' | 'presencial' | 'virtual';

/** Nivel académico de un programa virtual (los otros tipos no lo piden) */
export type ProgramLevel = 'pregrado' | 'posgrado';

/** Definición de un paso individual dentro de un bloque */
export interface StepDef {
  key: string;
  label: string;
  hasComment: boolean;
  commentRequired?: boolean;
  commentLabel?: string;
  /** segundo campo de texto libre, para pasos que necesitan anotar dos datos
   *  a la vez (p. ej. porcentaje de Turnitin y porcentaje de IA) */
  hasSecondComment?: boolean;
  secondCommentRequired?: boolean;
  secondCommentLabel?: string;
  /**
   * Este paso puntual se repite dentro de su mismo bloque (p. ej. reintentos
   * del reporte Turnitin dentro de "Libro") -- a diferencia de `repeatable`
   * en BlockDef, el resto de los pasos del bloque quedan fijos, solo este se
   * repite. Genera step_path del tipo "bloque.instancia.paso".
   */
  repeatable?: { max: number; itemLabel: string };
  /**
   * Este paso admite una fecha límite propia (independiente de si ya está
   * terminado). Cuando está por vencer y el paso aún no está en 'terminado',
   * se avisa por correo al encargado de la categoría del bloque -- ver
   * backend/src/lib/dueDateWarnings.ts.
   */
  hasDueDate?: boolean;
  dueDateLabel?: string;
  /**
   * Igual que `hasDueDate`, pero solo cuenta cuando la asignatura tiene
   * `videos_por_docente: true` (el profesor graba el video, no el equipo --
   * ahí sí hace falta una fecha límite dura para saber cuándo lo entrega).
   * Hoy solo lo usa "Creación de guión" de Video de contenido. Ver
   * pasoPideFechaLimite, la única función que debe leer este campo (en vez
   * de leer `hasDueDate` directo, que se queda corto para este paso).
   */
  dueDateSoloVideoTutorial?: boolean;
  /**
   * Fecha límite CALCULADA SOLA en vez de escrita a mano: el usuario solo
   * indica una fecha inicial (p. ej. "enviado al experto el...") y el
   * backend le suma `businessDays` días hábiles para obtener la fecha límite
   * (ver shared/businessDays.ts). Va siempre junto a `hasDueDate: true`.
   * A diferencia de una fecha límite normal, el aviso por correo (ver
   * dueDateWarnings.ts) NO se adelanta unos días antes -- solo se dispara
   * una vez que esa fecha límite YA venció y el paso sigue sin terminar (no
   * bloquea marcarlo como terminado antes de tiempo, si ya está listo).
   */
  autoDueDate?: { businessDays: number; referenceLabel?: string };
  /** este paso es un punto de decisión (¿hay ajustes?) */
  isBranchPoint?: boolean;
  /** este paso solo se muestra si la decisión indicada tiene cierto valor */
  branchOnlyIf?: { stepKey: string; equals: boolean };
  /**
   * Reetiqueta (y restringe) las opciones de estado que se muestran para
   * este paso puntual -- sigue siendo uno de los 6 CellStatus de siempre por
   * debajo (así el avance, los colores del tablero, el Excel y los avisos
   * por correo no cambian), solo cambia cómo se llaman los botones acá (p.
   * ej. ISBN: "Pendiente" / "Enviado a ediciones" / "Recibido"). Si no está,
   * se muestran los 6 estados de siempre con su nombre de siempre.
   */
  customStates?: { value: CellStatus; label: string }[];
  /** el campo de comentario (ver hasComment) solo se muestra una vez que el
   *  estado es 'terminado' -- para datos que solo tienen sentido al cerrar
   *  el paso (p. ej. el ISBN, que se asigna al recibirlo) */
  commentSoloSiTerminado?: boolean;
}

/** Definición de un bloque (sección) del proceso */
export interface BlockDef {
  key: string;
  label: string;
  steps: StepDef[];
  /** si el bloque se repite (OVAs, videos, guías, infografías) */
  repeatable?: {
    max: number;
    /** true = la cantidad sale de los créditos; false = siempre el máximo */
    perCredit: boolean;
    itemLabel: string;
    /**
     * Además de las instancias que salen por créditos, deja agregar
     * instancias extra a mano hasta `max` (p. ej. otro Video de contenido
     * si hace falta). Empiezan ocultas -- solo cuentan y se ven una vez que
     * tienen algún dato guardado (ver instanciasExtraEnUso/gruposVisibles).
     */
    extensible?: boolean;
  };
  /** bloque que aún está por confirmar si se sigue usando */
  optionalBlock?: boolean;
}

// ---- Entidades de la base de datos ----

export interface User {
  id: number;
  full_name: string;
  email: string;
  initials: string;
  role: UserRole;
  active: boolean;
  /** foto de perfil como data URL base64; null si no tiene */
  avatar_url: string | null;
}

export interface Program {
  id: number;
  name: string;
  notes: string | null;
  type: ProgramType;
  /** pregrado o posgrado -- solo aplica cuando type es 'virtual'; null en los demás */
  academic_level: ProgramLevel | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: number;
  program_id: number;
  semester: string;
  name: string;
  book_name: string | null;
  credits: number;
  modality: SubjectModality | null;
  hybrid_program_label: string | null;
  rights_email_date: string | null;
  general_comment: string | null;
  /** los videos los hace un profesor (no el equipo): los bloques de video se muestran como "Video tutorial" */
  videos_por_docente: boolean;
  /** fecha tentativa (dada por los docentes) de entrega del libro -- una sola por asignatura, solo se entrega un libro */
  book_due_date: string | null;
  /** última vez que se avisó que no se entregó el libro para esa fecha tentativa */
  book_due_warning_sent_at: string | null;
  /** última vez que se avisó que esta asignatura quedó 100% completa */
  completion_email_sent_at: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Un docente o autor de una asignatura, con su propia vigencia y tipo de contrato */
export interface SubjectTeacher {
  id: number;
  subject_id: number;
  full_name: string;
  start_date: string | null;
  end_date: string | null;
  contract_type: string | null;
  /** última vez que se avisó que este contrato está por vencer y la matriz aún tiene pendientes */
  contract_warning_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatrixCell {
  id: number;
  subject_id: number;
  step_path: string;
  status: CellStatus;
  done_date: string | null;
  initials: string | null;
  comment: string | null;
  second_comment: string | null;
  branch_value: boolean | null;
  /** fecha límite del paso, solo cuando StepDef.hasDueDate */
  due_date: string | null;
  /** última vez que se avisó que esta fecha límite está por vencer */
  due_date_warning_sent_at: string | null;
  /** fecha inicial de la que sale due_date, solo cuando StepDef.autoDueDate */
  reference_date: string | null;
  /** nota libre de quién quedó a cargo mientras el paso está "En proceso" --
   *  no tiene relación con el encargado por categoría (CategoryOwner) ni
   *  dispara avisos por correo, es solo un registro visible en el panel. */
  assigned_note: string | null;
  version: number;
  updated_at: string;
  updated_by: number | null;
}

/** Un paso resuelto para una asignatura concreta, con su ruta ya construida */
export interface ResolvedStep {
  path: string;
  blockKey: string;
  blockLabel: string;
  instance: number | null;
  /**
   * true salvo que sea una instancia "extra" de un bloque extensible (ver
   * BlockDef.repeatable.extensible) -- una que va más allá de lo que
   * corresponde por créditos y que solo cuenta/se ve si ya tiene datos.
   */
  garantizada: boolean;
  step: StepDef;
}

/** Un paso pendiente (no 'terminado') de una asignatura, para el reporte "qué falta" de un programa */
export interface PendienteItem extends ResolvedStep {
  celda: MatrixCell | null;
}

export interface PendientesAsignatura {
  subject: Subject;
  avance: { terminados: number; total: number; porcentaje: number };
  pendientes: PendienteItem[];
}

export interface PendientesPrograma {
  programa: { id: number; name: string };
  asignaturas: PendientesAsignatura[];
}

/**
 * Bloques del proceso que avisan por correo a su encargado cuando la fecha
 * límite de uno de sus pasos puntuales está por vencer (ovas/podcast/
 * video_contenido/guias/libro, ver StepDef.hasDueDate/autoDueDate y
 * dueDateWarnings.ts), o "contrato" (avisa por la fecha de fin de contrato
 * de cada docente, ver contractWarnings.ts -- no por la fecha límite de un
 * paso, porque "Tipo de contrato" no tiene una). Un paso que solo queda "En
 * proceso" NUNCA avisa por correo -- solo por fecha límite/contrato/entrega.
 * "jefe" es distinto a los demás: no es un bloque del proceso, es a quién se
 * le avisa de CUALQUIER paso (de cualquier apartado) que quede en "Pendiente
 * jefe" -- se maneja con el mismo mecanismo de encargados por conveniencia,
 * no porque sea una categoría más.
 */
export type CategoriaEncargado =
  | 'contrato' | 'podcast' | 'cuestionario_final' | 'guias' | 'ovas' | 'video_contenido' | 'libro' | 'jefe';

/**
 * La única categoría cuyo aviso por correo NO depende de la fecha límite de
 * un paso puntual (ver StepDef.hasDueDate/autoDueDate) -- "contrato" avisa
 * por la fecha de fin de contrato de cada docente (ver contractWarnings.ts).
 * Las demás categorías con encargado (ovas, podcast, video_contenido, guias,
 * libro) solo avisan por su paso con fecha límite. Sirve para decidir, en el
 * modal de cada paso, si de verdad tiene sentido mostrar ahí el selector de
 * encargado (ver PanelCelda.tsx) -- "cuestionario_final" no tiene ningún
 * paso con fecha límite, así que nunca lo muestra.
 */
export const CATEGORIAS_SIN_FECHA_EN_PASO: CategoriaEncargado[] = ['contrato'];

export interface CategoryOwner {
  category: CategoriaEncargado;
  label: string;
  userId: number | null;
  userFullName: string | null;
  userEmail: string | null;
}

/** Encargado de una categoría para UNA asignatura puntual -- pisa al global (CategoryOwner) solo ahí */
export interface SubjectCategoryOwner extends CategoryOwner {
  /** true si esta asignatura tiene su propio encargado; false si está usando el global */
  esPropio: boolean;
  /** nombre del encargado global de esta categoría, como referencia cuando esPropio es false */
  globalUserFullName: string | null;
}

export const CATEGORIAS_ENCARGADO: Record<CategoriaEncargado, string> = {
  contrato: 'Tipo de contrato',
  podcast: 'Podcast',
  cuestionario_final: 'Cuestionario final',
  guias: 'Guías',
  ovas: 'OVA',
  video_contenido: 'Video de contenido',
  libro: 'Libro',
  jefe: 'Jefe (todo lo que quede "Pendiente jefe")',
};

/** Configuración global de la app (una sola fila) -- ver app_settings */
export interface AppSettings {
  /** Link externo a la matriz de seguimiento en Excel que se manejaba antes; null si nadie lo cargó */
  matrizExcelUrl: string | null;
}

/** Resumen de avance de un solo apartado o programa (ver DashboardResumen) */
export interface AvanceResumen {
  terminados: number;
  total: number;
  porcentaje: number;
}

/** Respuesta de GET /dashboard -- métricas y porcentajes de avance de toda la
 *  app (todos los programas activos a la vez), para la pantalla de Dashboard. */
export interface DashboardResumen {
  generadoEn: string;
  programas: { total: number; porTipo: Record<ProgramType, number> };
  asignaturas: { total: number };
  docentes: { total: number };
  /** apartados de instancias garantizadas que el equipo bloqueó a mano (ver subject_removed_instances) */
  bloqueados: number;
  avanceGlobal: AvanceResumen;
  /** cuántos pasos (de los que aplican) están en cada estado, sumando todas las asignaturas */
  porEstado: Record<CellStatus, number>;
  /** avance por apartado del proceso (OVA, Libro, Guía...), ordenado de menor a mayor avance */
  porApartado: (AvanceResumen & { blockKey: string; label: string })[];
  /** avance por programa, ordenado de menor a mayor avance */
  porPrograma: (AvanceResumen & { id: number; name: string; type: ProgramType; asignaturas: number })[];
  /** las 10 asignaturas con menor avance de toda la app, ordenadas de menor a mayor */
  asignaturasMasAtrasadas: (AvanceResumen & { id: number; name: string; programId: number; programName: string })[];
  /** pasos que pasaron a "terminado" por semana, últimas 8 semanas (lunes de cada semana, 'YYYY-MM-DD') */
  tendenciaSemanal: { semana: string; terminados: number }[];
  /** fechas límite, contratos y entregas de libro por vencer o ya vencidos, ordenadas por urgencia */
  alertas: AlertaResumen[];
}

/** Una fecha límite, un contrato de docente o una entrega de libro por vencer
 *  o ya vencido (ver cargarAlertas en backend/src/routes/dashboard.ts) */
export interface AlertaResumen {
  tipo: 'fecha_limite' | 'contrato' | 'libro';
  etiqueta: string;
  asignatura: string;
  programa: string;
  subjectId: number;
  /** step_path sin el último tramo, para armar el link directo (?apartado=...) */
  apartado: string;
  fecha: string;
  /** negativo = ya venció */
  diasRestantes: number;
}

// ---- Eventos de Socket.IO ----

export interface CellUpdatePayload {
  subjectId: number;
  stepPath: string;
  status?: CellStatus;
  doneDate?: string | null;
  comment?: string | null;
  secondComment?: string | null;
  branchValue?: boolean | null;
}