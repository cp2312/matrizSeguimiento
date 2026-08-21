import type { BlockDef, ResolvedStep } from './types.js';


export const PIPELINE_TEMPLATE: BlockDef[] = [

  // --------------------------------------------------------------------------
  //  Firma de derechos y registro DN/DA
  //  A partir de aqui todo paso lleva fecha + iniciales del responsable.
  // --------------------------------------------------------------------------
  {
    key: 'derechos',
    label: 'Firma cesión de derechos / Registro DNDA',
    steps: [
      {
        key: 'firma_derechos',
        label: 'Firma cesión de derechos y registro DNDA',
        hasComment: true,
        commentLabel: 'Fecha de envío de los correos',
      },
    ],
  },

  // --------------------------------------------------------------------------
  //  Entregables — vigencia del contrato
  //  Las fechas de inicio y fin viven en la tabla subjects, no aqui.
  // --------------------------------------------------------------------------
  {
    key: 'entregables',
    label: 'Entregables',
    steps: [
      {
        key: 'entregables',
        label: 'Entregables',
        hasComment: true,
        commentLabel: 'Observaciones del entregable',
      },
    ],
  },

  // --------------------------------------------------------------------------
  //  Tipo de contrato
  // --------------------------------------------------------------------------
  {
    key: 'contrato',
    label: 'Tipo de contrato',
    steps: [
      {
        key: 'tipo_contrato',
        label: 'Tipo de contrato',
        hasComment: true,
        commentLabel: 'Prórroga u observación',
      },
    ],
  },

  // --------------------------------------------------------------------------
  //  Libro
  // --------------------------------------------------------------------------
  {
    key: 'libro',
    label: 'Libro',
    steps: [
      { key: 'recepcion_libro', label: 'Recepción de libro', hasComment: false },
      {
        key: 'reporte_turnitin',
        label: 'Reporte Turnitin',
        hasComment: true,
        commentLabel: 'Porcentaje en que salió el reporte',
      },
      { key: 'envio_ajustes_experto', label: 'Envío para ajustes de experto', hasComment: true },
      { key: 'recepcion_ajustes', label: 'Recepción ajustes', hasComment: true },
      { key: 'revision_par_disciplinar', label: 'Revisión par disciplinar', hasComment: true },
      { key: 'correccion_estilo', label: 'Corrección de estilo', hasComment: false },
      { key: 'envio_diseno_grafico', label: 'Envío a diseño gráfico', hasComment: true },
      {
        key: 'recepcion_libro_disenado',
        label: 'Recepción de libro diseñado',
        hasComment: true,
        commentLabel: 'Ajustes',
      },
      {
        key: 'turnitin_repositorio',
        label: 'Turnitin - Libro en repositorio',
        hasComment: true,
        commentRequired: true,
        commentLabel: 'Porcentaje de Turnitin',
      },
    ],
  },

  // --------------------------------------------------------------------------
  //  Unidad gráfica
  // --------------------------------------------------------------------------
  {
    key: 'unidad_grafica',
    label: 'Unidad gráfica',
    steps: [
      { key: 'solicitud_unidad_grafica', label: 'Solicitud de unidad gráfica', hasComment: false },
      { key: 'recepcion_unidad_grafica', label: 'Recepción de unidad gráfica', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Estructura
  // --------------------------------------------------------------------------
  {
    key: 'estructura',
    label: 'Estructura',
    steps: [
      { key: 'elaboracion_estructura', label: 'Elaboración estructura', hasComment: true },
      { key: 'reunion_inicial', label: 'Reunión inicial', hasComment: false },
      { key: 'revision_experto', label: 'Revisión estructura por experto', hasComment: false },
      { key: 'estructura_final', label: 'Estructura final', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Rutas
  //  OJO: si no hay ajustes por CV el proceso salta directo a la ruta final.
  //  Si si los hay, se habilita la segunda entrega del experto.
  // --------------------------------------------------------------------------
  {
    key: 'rutas',
    label: 'Rutas',
    steps: [
      { key: 'reunion_inicial_experto', label: 'Reunión inicial con experto', hasComment: false },
      { key: 'entrega_inicial_experto', label: 'Entrega inicial por experto', hasComment: false },
      {
        key: 'ajustes_cv',
        label: 'Ajustes por CV',
        hasComment: false,
        isBranchPoint: true,
      },
      {
        key: 'segunda_entrega_experto',
        label: 'Segunda entrega por experto',
        hasComment: false,
        branchOnlyIf: { stepKey: 'ajustes_cv', equals: true },
      },
      { key: 'ruta_final', label: 'Ruta final CV', hasComment: false },
      { key: 'montaje_carpeta_drive', label: 'Montaje a carpeta Drive', hasComment: false },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: true },
    ],
  },

  // --------------------------------------------------------------------------
  //  OVAs — una por credito, maximo 5
  // --------------------------------------------------------------------------
  {
    key: 'ovas',
    label: 'OVA',
    repeatable: { max: 5, perCredit: true, itemLabel: 'OVA' },
    steps: [
      { key: 'creacion_guion', label: 'Creación de guión', hasComment: false },
      { key: 'paso_diseno_grafico', label: 'Paso a diseño gráfico', hasComment: false },
      { key: 'revision_final', label: 'Revisión final', hasComment: false },
      { key: 'hay_ajustes', label: '¿Hay ajustes?', hasComment: false, isBranchPoint: true },
      {
        key: 'solicitud_ajustes',
        label: 'Solicitud ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      {
        key: 'validacion_ajustes',
        label: 'Validación de ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Podcast — sin comentarios en ningun paso
  // --------------------------------------------------------------------------
  {
    key: 'podcast',
    label: 'Podcast',
    steps: [
      { key: 'creacion_guion', label: 'Creación de guión', hasComment: false },
      { key: 'revision_guion', label: 'Revisión de guión', hasComment: false },
      { key: 'grabacion_podcast', label: 'Grabación de podcast', hasComment: false },
      { key: 'revision_final', label: 'Revisión final', hasComment: false },
      { key: 'hay_ajustes', label: '¿Hay ajustes?', hasComment: false, isBranchPoint: true },
      {
        key: 'solicitud_ajustes',
        label: 'Solicitud ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      {
        key: 'validacion_ajustes',
        label: 'Validación de ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Video de bienvenida
  // --------------------------------------------------------------------------
  {
    key: 'video_bienvenida',
    label: 'Video de bienvenida',
    steps: [
      { key: 'creacion_guion', label: 'Creación de guión', hasComment: false },
      { key: 'solicitud_audios', label: 'Solicitud de audios', hasComment: false },
      { key: 'paso_desarrollo', label: 'Paso a desarrollo', hasComment: false },
      { key: 'revision_final', label: 'Revisión final', hasComment: false },
      { key: 'hay_ajustes', label: '¿Hay ajustes?', hasComment: false, isBranchPoint: true },
      {
        key: 'solicitud_ajustes',
        label: 'Solicitud ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      {
        key: 'validacion_ajustes',
        label: 'Validación de ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Videos de contenido — uno por credito, maximo 5.
  //  Misma estructura que el video de bienvenida.
  // --------------------------------------------------------------------------
  {
    key: 'video_contenido',
    label: 'Video de contenido',
    repeatable: { max: 5, perCredit: true, itemLabel: 'Video de contenido' },
    steps: [
      { key: 'creacion_guion', label: 'Creación de guión', hasComment: false },
      { key: 'solicitud_audios', label: 'Solicitud de audios', hasComment: false },
      { key: 'paso_desarrollo', label: 'Paso a desarrollo', hasComment: false },
      { key: 'revision_final', label: 'Revisión final', hasComment: false },
      { key: 'hay_ajustes', label: '¿Hay ajustes?', hasComment: false, isBranchPoint: true },
      {
        key: 'solicitud_ajustes',
        label: 'Solicitud ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      {
        key: 'validacion_ajustes',
        label: 'Validación de ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Infografias — siempre 2, no dependen de los creditos
  // --------------------------------------------------------------------------
  {
    key: 'infografia',
    label: 'Infografía',
    repeatable: { max: 2, perCredit: false, itemLabel: 'Infografía' },
    steps: [
      { key: 'creacion_guion', label: 'Creación de guión', hasComment: false },
      { key: 'montaje_genially', label: 'Montaje en Genially', hasComment: false },
      { key: 'revision_final', label: 'Revisión final', hasComment: false },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Cuestionario final
  // --------------------------------------------------------------------------
  {
    key: 'cuestionario_final',
    label: 'Cuestionario final',
    steps: [
      { key: 'recepcion_experto', label: 'Recepción por experto', hasComment: false },
      { key: 'revision_cuestionario', label: 'Revisión cuestionario', hasComment: false },
      { key: 'hay_ajustes', label: '¿Hay ajustes?', hasComment: false, isBranchPoint: true },
      {
        key: 'solicitud_ajustes',
        label: 'Solicitud ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      {
        key: 'validacion_ajustes',
        label: 'Validación ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Guias — una por credito, maximo 5
  // --------------------------------------------------------------------------
  {
    key: 'guias',
    label: 'Guía',
    repeatable: { max: 5, perCredit: true, itemLabel: 'Guía' },
    steps: [
      { key: 'recepcion_experto', label: 'Recepción por experto', hasComment: false },
      { key: 'paso_diseno_grafico', label: 'Paso a diseño gráfico', hasComment: false },
      { key: 'hay_ajustes', label: '¿Hay ajustes?', hasComment: false, isBranchPoint: true },
      {
        key: 'solicitud_ajustes',
        label: 'Solicitud ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      {
        key: 'validacion_ajustes',
        label: 'Validación ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Contenidos de apoyo
  // --------------------------------------------------------------------------
  {
    key: 'contenidos_apoyo',
    label: 'Contenidos de apoyo',
    steps: [
      { key: 'elaboracion_formato', label: 'Elaboración formato', hasComment: false },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Syllabus
  // --------------------------------------------------------------------------
  {
    key: 'syllabus',
    label: 'Syllabus',
    steps: [
      { key: 'proyeccion_inicial', label: 'Proyección inicial', hasComment: false },
      { key: 'recepcion_ajustes_experto', label: 'Recepción ajustes por experto', hasComment: false },
      { key: 'validacion_ajustes', label: 'Validación ajustes', hasComment: false },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Montaje a plataforma
  // --------------------------------------------------------------------------
  {
    key: 'montaje_plataforma',
    label: 'Montaje a plataforma',
    steps: [
      { key: 'solicitud_montaje', label: 'Solicitud de montaje', hasComment: false },
      { key: 'revision_montaje', label: 'Revisión montaje', hasComment: false },
      { key: 'hay_ajustes', label: '¿Hay ajustes?', hasComment: false, isBranchPoint: true },
      {
        key: 'solicitud_ajustes',
        label: 'Solicitud ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
      {
        key: 'validacion_ajustes',
        label: 'Validación ajustes',
        hasComment: false,
        branchOnlyIf: { stepKey: 'hay_ajustes', equals: true },
      },
    ],
  },

  // --------------------------------------------------------------------------
  //  Ruta visual
  // --------------------------------------------------------------------------
  {
    key: 'ruta_visual',
    label: 'Ruta visual',
    steps: [
      { key: 'elaboracion_ruta', label: 'Elaboración de ruta', hasComment: false },
      { key: 'actualizacion_matriz', label: 'Actualización en matriz', hasComment: false },
    ],
  },

  // --------------------------------------------------------------------------
  //  Revision final
  //  Marcado como opcional: esta por confirmar si el equipo lo sigue usando.
  //  El link de aula si se usa siempre, porque ahi se ubican los cursos.
  // --------------------------------------------------------------------------
  {
    key: 'revision_final',
    label: 'Revisión final',
    optionalBlock: true,
    steps: [
      { key: 'envio_docente_revision', label: 'Envío a docente para revisión', hasComment: false },
      { key: 'revision_realizada', label: 'Revisión realizada', hasComment: false },
      {
        key: 'link_aula',
        label: 'Link aula',
        hasComment: true,
        commentRequired: true,
        commentLabel: 'URL del aula virtual',
      },
    ],
  },
];


// ============================================================================
//  FUNCIONES DE APOYO
// ============================================================================

/** Cuantas instancias genera un bloque para una asignatura de N creditos */
export function computeRepeatCount(block: BlockDef, credits: number): number {
  if (!block.repeatable) return 1;
  if (!block.repeatable.perCredit) return block.repeatable.max;
  return Math.max(1, Math.min(block.repeatable.max, credits));
}

/**
 * Construye la lista completa de pasos que le corresponden a una asignatura
 * segun sus creditos, con el step_path de cada uno ya armado.
 */
export function buildStepPaths(credits: number): ResolvedStep[] {
  const resultado: ResolvedStep[] = [];

  for (const block of PIPELINE_TEMPLATE) {
    const veces = computeRepeatCount(block, credits);

    for (let i = 1; i <= veces; i++) {
      const instance = block.repeatable ? i : null;
      const blockLabel = instance ? `${block.repeatable!.itemLabel} ${i}` : block.label;

      for (const step of block.steps) {
        const path = instance
          ? `${block.key}.${instance}.${step.key}`
          : `${block.key}.${step.key}`;

        resultado.push({ path, blockKey: block.key, blockLabel, instance, step });
      }
    }
  }

  return resultado;
}

/** Descompone un step_path en sus partes */
export function parseStepPath(path: string): {
  blockKey: string;
  instance: number | null;
  stepKey: string;
} {
  const partes = path.split('.');

  return partes.length === 3
    ? { blockKey: partes[0], instance: Number(partes[1]), stepKey: partes[2] }
    : { blockKey: partes[0], instance: null, stepKey: partes[1] };
}

/** Busca la definicion de un paso a partir de su step_path. null si no existe. */
export function findStepDef(path: string) {
  const { blockKey, stepKey } = parseStepPath(path);
  const block = PIPELINE_TEMPLATE.find((b) => b.key === blockKey);
  if (!block) return null;

  const step = block.steps.find((s) => s.key === stepKey);
  if (!step) return null;

  return { block, step };
}

/**
 * Valida que un step_path exista realmente en el proceso y que la instancia
 * este dentro del rango permitido para esa cantidad de creditos.
 */
export function isValidStepPath(path: string, credits: number): boolean {
  const found = findStepDef(path);
  if (!found) return false;

  const { instance } = parseStepPath(path);
  const esperado = computeRepeatCount(found.block, credits);

  // Un bloque no repetible no admite instancia, y viceversa
  if (found.block.repeatable && instance === null) return false;
  if (!found.block.repeatable && instance !== null) return false;

  if (instance !== null && (instance < 1 || instance > esperado)) return false;

  return true;
}

/** Cuantos pasos tiene en total una asignatura de N creditos */
export function totalSteps(credits: number): number {
  return buildStepPaths(credits).length;
}