

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

/**
 * Bloques del proceso que avisan por correo a su encargado cuando un paso
 * queda "En proceso" (pendiente_equipo), o (ovas/podcast/video_contenido/
 * guias) cuando la fecha límite de uno de sus pasos está por vencer. "jefe"
 * es distinto a los demás: no es un bloque del proceso, es a quién se le
 * avisa de CUALQUIER paso (de cualquier apartado) que quede en "Pendiente
 * jefe" -- se maneja con el mismo mecanismo de encargados por conveniencia,
 * no porque sea una categoría más.
 */
export type CategoriaEncargado =
  | 'contrato' | 'podcast' | 'cuestionario_final' | 'guias' | 'ovas' | 'video_contenido' | 'libro' | 'jefe';

export interface CategoryOwner {
  category: CategoriaEncargado;
  label: string;
  userId: number | null;
  userFullName: string | null;
  userEmail: string | null;
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