

export type CellStatus =
  | 'vacio'
  | 'pendiente_equipo'
  | 'pendiente_jefe'
  | 'ajustes'
  | 'terminado'
  | 'por_revisar';

export type UserRole = 'usuario' | 'administrador';

export type SubjectModality = 'presencial' | 'virtual';

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
  is_hybrid: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: number;
  program_id: number;
  semester: string;
  name: string;
  teachers_comment: string | null;
  book_name: string | null;
  credits: number;
  modality: SubjectModality | null;
  hybrid_program_label: string | null;
  rights_email_date: string | null;
  deliverable_start_date: string | null;
  deliverable_end_date: string | null;
  contract_type: string | null;
  contract_comment: string | null;
  general_comment: string | null;
  archived: boolean;
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

// ---- Eventos de Socket.IO ----

export interface CellUpdatePayload {
  subjectId: number;
  stepPath: string;
  status?: CellStatus;
  doneDate?: string | null;
  comment?: string | null;
  branchValue?: boolean | null;
}