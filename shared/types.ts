

export type CellStatus =
  | 'vacio'
  | 'pendiente_equipo'
  | 'pendiente_jefe'
  | 'ajustes'
  | 'terminado'
  | 'por_revisar';

export type UserRole = 'usuario' | 'administrador';

export type SubjectModality = 'presencial' | 'virtual';

/** Tipo de un programa. Solo "hibrido" pide modalidad por asignatura */
export type ProgramType = 'hibrido' | 'presencial' | 'virtual';

/** Definición de un paso individual dentro de un bloque */
export interface StepDef {
  key: string;
  label: string;
  hasComment: boolean;
  commentRequired?: boolean;
  commentLabel?: string;
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
  branch_value: boolean | null;
  updated_at: string;
  updated_by: number | null;
}

/** Un paso resuelto para una asignatura concreta, con su ruta ya construida */
export interface ResolvedStep {
  path: string;
  blockKey: string;
  blockLabel: string;
  instance: number | null;
  step: StepDef;
}

/** Bloques del proceso que avisan por correo cuando un paso queda pendiente */
export type CategoriaEncargado = 'contrato' | 'podcast' | 'cuestionario_final' | 'guias';

export interface CategoryOwner {
  category: CategoriaEncargado;
  label: string;
  userId: number | null;
  userFullName: string | null;
  userEmail: string | null;
}

/** Categorías que avisan por correo a su encargado cuando un paso queda pendiente */
export const CATEGORIAS_ENCARGADO: Record<CategoriaEncargado, string> = {
  contrato: 'Tipo de contrato',
  podcast: 'Podcast',
  cuestionario_final: 'Cuestionario final',
  guias: 'Guías',
};

// ---- Eventos de Socket.IO ----

export interface CellUpdatePayload {
  subjectId: number;
  stepPath: string;
  status?: CellStatus;
  doneDate?: string | null;
  comment?: string | null;
  branchValue?: boolean | null;
}