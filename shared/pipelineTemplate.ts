import type { BlockDef, MatrixCell, ResolvedStep, StepDef } from './types.js';


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
  //  Tipo de contrato
  //  Las fechas de inicio y fin de cada docente viven en subject_teachers, no aqui.
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
  //  Entregables
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
  //  Libro
  // --------------------------------------------------------------------------
  {
    key: 'libro',
    label: 'Libro',
    steps: [
      { key: 'recepcion_libro', label: 'Recepción de libro', hasComment: false },
      {
        // Reintentos: si el porcentaje sale muy alto a veces hay que repetir la
        // prueba. `repeatable` aqui (a nivel de paso, no de bloque) hace que
        // este paso puntual genere hasta 3 intentos SIN sacar el resto de
        // "Libro" de su sitio -- todo sigue viviendo en el mismo apartado.
        key: 'reporte_turnitin',
        label: 'Reporte Turnitin',
        repeatable: { max: 3, itemLabel: 'Reporte Turnitin' },
        hasComment: true,
        commentRequired: true,
        commentLabel: 'Porcentaje de Turnitin',
        hasSecondComment: true,
        secondCommentLabel: 'Porcentaje de IA',
      },
      {
        key: 'envio_ajustes_experto',
        label: 'Envío para ajustes de experto',
        hasComment: true,
        hasDueDate: true,
        // La fecha límite no se escribe a mano: sale sola de la fecha de envío + 4
        // días hábiles. Si para entonces sigue sin terminar, se avisa por correo al
        // encargado de "Libro" (ver dueDateWarnings.ts).
        autoDueDate: { businessDays: 4, referenceLabel: 'Fecha de envío al experto' },
      },
      { key: 'recepcion_ajustes', label: 'Recepción ajustes', hasComment: true },
      { key: 'revision_par_disciplinar', label: 'Revisión par disciplinar', hasComment: true },
      {
        // Igual que reporte_turnitin: repetible a nivel de paso, para cuando
        // hace falta una segunda pasada de corrección de estilo.
        key: 'correccion_estilo',
        label: 'Corrección de estilo',
        repeatable: { max: 2, itemLabel: 'Corrección de estilo' },
        hasComment: false,
      },
      { key: 'envio_diseno_grafico', label: 'Envío a diseño gráfico', hasComment: true },
      {
        key: 'isbn',
        label: 'ISBN',
        hasComment: true,
        commentRequired: true,
        commentLabel: 'ISBN',
        commentSoloSiTerminado: true,
        customStates: [
          { value: 'vacio', label: 'Pendiente' },
          { value: 'pendiente_equipo', label: 'Enviado a ediciones' },
          { value: 'terminado', label: 'Recibido / Finalizado' },
        ],
      },
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
        hasSecondComment: true,
        secondCommentLabel: 'Porcentaje de IA',
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
  //  OVAs — una por credito, maximo 5. Extensible: si hace falta, se puede
  //  agregar otra a mano mas alla de lo que corresponde por creditos.
  // --------------------------------------------------------------------------
  {
    key: 'ovas',
    label: 'OVA',
    repeatable: { max: 5, perCredit: true, itemLabel: 'OVA', extensible: true },
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
  //  Podcast — sin comentarios en ningun paso. Siempre arranca en 1 (no
  //  depende de creditos), pero es extensible: si hace falta otro, se agrega
  //  a mano hasta el tope de 5, igual que OVA y Video de contenido.
  // --------------------------------------------------------------------------
  {
    key: 'podcast',
    label: 'Podcast',
    repeatable: { max: 5, perCredit: false, itemLabel: 'Podcast', extensible: true },
    steps: [
      { key: 'creacion_guion', label: 'Creación de guión', hasComment: false, hasDueDate: true },
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
  //  Misma estructura que el video de bienvenida. Extensible: ademas de los
  //  que salen por creditos, se puede agregar otro a mano (por si hace
  //  falta) hasta llegar al tope de 5 -- ver BlockDef.repeatable.extensible.
  // --------------------------------------------------------------------------
  {
    key: 'video_contenido',
    label: 'Video de contenido',
    repeatable: { max: 5, perCredit: true, itemLabel: 'Video de contenido', extensible: true },
    steps: [
      {
        key: 'creacion_guion', label: 'Creación de guión', hasComment: false,
        // Fecha límite solo cuando lo graba el profesor (ver videos_por_docente
        // en Subject) -- ahí sí hace falta una fecha dura para su entrega. Cuando
        // lo hace el equipo, se sigue por el pipeline normal sin fecha límite.
        dueDateSoloVideoTutorial: true,
      },
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
      { key: 'recepcion_experto', label: 'Recepción por experto', hasComment: false, hasDueDate: true },
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
  //  Guias — una por credito, maximo 5. Extensible: si hace falta, se puede
  //  agregar otra a mano mas alla de lo que corresponde por creditos (y
  //  quitarla despues si al final no se usa).
  // --------------------------------------------------------------------------
  {
    key: 'guias',
    label: 'Guía',
    repeatable: { max: 5, perCredit: true, itemLabel: 'Guía', extensible: true },
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

/**
 * Cuantas instancias GARANTIZA un bloque para una asignatura de N creditos
 * (las que se ven siempre, sin agregar nada a mano).
 */
export function computeRepeatCount(block: BlockDef, credits: number): number {
  if (!block.repeatable) return 1;
  // Extensible + no depende de creditos (p. ej. Podcast): arranca en 1 nomas
  // -- el resto, hasta el tope, se agrega a mano bajo demanda.
  if (block.repeatable.extensible && !block.repeatable.perCredit) return 1;
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
    const garantizadas = computeRepeatCount(block, credits);
    // Un bloque extensible genera de una vez todas sus instancias posibles
    // (hasta el tope), no solo las que corresponden por creditos -- las de
    // mas alla quedan marcadas garantizada:false y las oculta/cuenta aparte
    // instanciasExtraEnUso / gruposVisibles, segun tengan datos o no.
    const veces = block.repeatable?.extensible ? block.repeatable.max : garantizadas;

    for (let i = 1; i <= veces; i++) {
      const blockInstance = block.repeatable ? i : null;
      const blockLabel = blockInstance ? `${block.repeatable!.itemLabel} ${i}` : block.label;
      const garantizada = blockInstance === null || i <= garantizadas;

      for (const step of block.steps) {
        if (step.repeatable) {
          // Paso repetible DENTRO de su bloque (p. ej. reintentos de Turnitin
          // en "Libro"): el resto de los pasos del bloque quedan fijos, solo
          // este genera varias instancias -- usa el mismo formato de path
          // que un bloque repetible ("bloque.instancia.paso"). Es un
          // mecanismo aparte del de bloque extensible, por eso garantizada
          // siempre true aqui -- pasosVisibles lo filtra por su cuenta.
          for (let si = 1; si <= step.repeatable.max; si++) {
            const path = `${block.key}.${si}.${step.key}`;
            resultado.push({ path, blockKey: block.key, blockLabel, instance: si, garantizada: true, step });
          }
        } else {
          const path = blockInstance
            ? `${block.key}.${blockInstance}.${step.key}`
            : `${block.key}.${step.key}`;

          resultado.push({ path, blockKey: block.key, blockLabel, instance: blockInstance, garantizada, step });
        }
      }
    }
  }

  return resultado;
}

/**
 * De las instancias "extra" de bloques extensibles (mas alla de lo que
 * corresponde por creditos), cuales ya tienen al menos un dato guardado --
 * esas son las que se quedan contando/visibles aunque no vengan garantizadas.
 * Devuelve claves "bloque.instancia".
 */
export function instanciasExtraEnUso(
  pasos: ResolvedStep[],
  celdas: Record<string, Pick<MatrixCell, 'branch_value'>>
): Set<string> {
  const enUso = new Set<string>();
  for (const p of pasos) {
    if (p.instance !== null && !p.garantizada && celdas[p.path]) {
      enUso.add(`${p.blockKey}.${p.instance}`);
    }
  }
  return enUso;
}

/**
 * Saca del todo las instancias "extra" de un bloque extensible que todavia
 * no se usan. A diferencia de pasosVisibles (que decide que PASOS se ven
 * dentro de una instancia ya elegida -- y por eso no debe tocar esto, o una
 * instancia recien agregada y sin guardar se quedaría sin ningún paso que
 * mostrar), esta decide que INSTANCIAS completas cuentan. La usa el backend
 * para el avance/total agregado, y el frontend (ver gruposVisibles en
 * lib/bloques) para armar la lista de apartados visibles.
 */
export function excluirInstanciasExtraSinUsar(
  pasos: ResolvedStep[],
  celdas: Record<string, Pick<MatrixCell, 'branch_value'>>
): ResolvedStep[] {
  const enUso = instanciasExtraEnUso(pasos, celdas);
  return pasos.filter(
    (p) => p.instance === null || p.garantizada || enUso.has(`${p.blockKey}.${p.instance}`)
  );
}

/**
 * Saca las instancias que el equipo marcó a mano como "no aplica" para esta
 * asignatura puntual -- a diferencia de una instancia EXTRA sin usar (que se
 * oculta sola en cuanto no tiene celdas, ver excluirInstanciasExtraSinUsar),
 * una instancia GARANTIZADA por créditos (p. ej. "OVA 1" con 1 crédito)
 * sigue generándose siempre acá, así que hace falta esta lista aparte (ver
 * subject_removed_instances en el backend) para que deje de contar en el
 * avance aunque los créditos digan que corresponde. `quitadas` son claves
 * "bloque.instancia".
 */
export function excluirInstanciasQuitadas(
  pasos: ResolvedStep[],
  quitadas: ReadonlySet<string>
): ResolvedStep[] {
  if (quitadas.size === 0) return pasos;
  return pasos.filter((p) => p.instance === null || !quitadas.has(`${p.blockKey}.${p.instance}`));
}

/**
 * Un paso "propagable" es de los primeros de un bloque repetible -- antes de
 * la revisión final (o del punto de decisión de ajustes, si el bloque no
 * tiene revisión final, como Guías) -- que casi siempre se resuelve igual
 * para todas las instancias a la vez (p. ej. se escriben los guiones de
 * todas las OVA juntos, antes de mandarlos a producción; recién en la
 * revisión final cada una puede salir distinta). Al marcar uno como
 * terminado, el backend copia el mismo dato a las demás instancias del
 * bloque que todavía tengan ese paso vacío (ver matrix.ts) -- nunca pisa una
 * que ya se tocó a mano.
 */
export function esPasoPropagable(block: BlockDef, step: StepDef): boolean {
  if (!block.repeatable) return false;

  for (const s of block.steps) {
    const esFrontera = s.key === 'revision_final' || !!s.isBranchPoint;
    if (s.key === step.key) return !esFrontera;
    if (esFrontera) return false;
  }
  return false;
}

/**
 * Los pasos que de verdad aplican a esta asignatura: ni instancias extra sin
 * usar (excluirInstanciasExtraSinUsar) ni instancias quitadas a mano
 * (excluirInstanciasQuitadas), sean garantizadas por créditos o no. Junta los
 * dos filtros porque casi todos los que calculan avance/pendientes los usan
 * siempre juntos.
 */
export function pasosAplicables(
  pasos: ResolvedStep[],
  celdas: Record<string, Pick<MatrixCell, 'branch_value'>>,
  quitadas: ReadonlySet<string>
): ResolvedStep[] {
  return excluirInstanciasQuitadas(excluirInstanciasExtraSinUsar(pasos, celdas), quitadas);
}

/**
 * Si TODAS las instancias garantizadas por créditos de este bloque están
 * quitadas a mano -- el apartado completo "no aplica" para esta asignatura
 * (ver bloquear/desbloquear en backend/src/routes/matrix.ts). false si el
 * bloque no es repetible, o si no tiene ninguna instancia garantizada, o si
 * queda alguna sin quitar.
 */
export function bloqueCompletamenteQuitado(
  block: BlockDef,
  credits: number,
  quitadas: ReadonlySet<string>
): boolean {
  if (!block.repeatable) return false;
  const garantizadas = computeRepeatCount(block, credits);
  if (garantizadas === 0) return false;
  for (let i = 1; i <= garantizadas; i++) {
    if (!quitadas.has(`${block.key}.${i}`)) return false;
  }
  return true;
}

/**
 * Etiqueta a mostrar para un paso ya resuelto. Si el paso se repite dentro de
 * su bloque (ver StepDef.repeatable), le agrega el número de intento --
 * "Reporte Turnitin 2" -- para poder distinguirlos en la misma vista. El
 * `instance` de un bloque repetible (OVA, Guía...) no aplica aquí: ese ya se
 * ve reflejado en el título del apartado ("OVA 2"), no hace falta repetirlo
 * en cada paso suyo.
 */
export function etiquetaPaso(step: StepDef, instance: number | null): string {
  return step.repeatable && instance ? `${step.label} ${instance}` : step.label;
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

/**
 * Si este paso pide fecha límite para esta asignatura en concreto -- igual
 * que StepDef.hasDueDate, salvo "Creación de guión" de Video de contenido
 * (StepDef.dueDateSoloVideoTutorial), que solo la pide cuando el video lo
 * graba el profesor. Toda la app (frontend y backend) debe consultar esta
 * función en vez de leer `step.hasDueDate` directo, para que ese caso quede
 * bien resuelto en un solo lugar.
 */
export function pasoPideFechaLimite(step: StepDef, videoPorDocente: boolean): boolean {
  if (step.hasDueDate) return true;
  if (step.dueDateSoloVideoTutorial) return videoPorDocente;
  return false;
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

  // Paso repetible dentro de su bloque (p. ej. reintentos de Turnitin): la
  // instancia siempre es obligatoria y su rango sale del propio paso, no del
  // bloque -- el bloque en si no es repetible.
  if (found.step.repeatable) {
    if (instance === null) return false;
    return instance >= 1 && instance <= found.step.repeatable.max;
  }

  // Un bloque extensible (ver BlockDef.repeatable.extensible) admite
  // instancias mas alla de lo que corresponde por creditos, hasta su tope
  // -- las de mas alla las controla instanciasExtraEnUso, no esta validacion.
  const esperado = found.block.repeatable?.extensible
    ? found.block.repeatable.max
    : computeRepeatCount(found.block, credits);

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

/**
 * Oculta los pasos condicionales cuya decision previa no coincide (p. ej.
 * "Solicitud de ajustes" cuando ya se respondio "No hay ajustes") y, para un
 * paso repetible dentro de su bloque (p. ej. los reintentos de Turnitin en
 * "Libro"), los intentos siguientes al primero mientras NO tengan su propio
 * dato guardado -- asi no se ven de entrada los 3 cupos, solo el primero (mas
 * el botón "agregar otro" del frontend, que abre el panel de un intento
 * todavia sin guardar). OJO: la condicion es que el intento MISMO tenga
 * celda, no el anterior -- si fuera "el anterior ya tiene celda" el cupo
 * siguiente se revelaria solo (y quedaria contando para siempre) apenas se
 * guarde el intento previo, aunque nadie lo vaya a usar. Es la unica fuente
 * de verdad de que pasos aplican realmente -- la usan tanto el frontend
 * (para no mostrarlos) como el backend (para no contarlos en el avance ni en
 * el color agregado del tablero).
 */
export function pasosVisibles(
  pasos: ResolvedStep[],
  celdas: Record<string, Pick<MatrixCell, 'branch_value'>>
): ResolvedStep[] {
  return pasos.filter((p) => {
    if (p.step.branchOnlyIf) {
      const base = p.instance
        ? `${p.blockKey}.${p.instance}.${p.step.branchOnlyIf.stepKey}`
        : `${p.blockKey}.${p.step.branchOnlyIf.stepKey}`;

      if (celdas[base]?.branch_value !== p.step.branchOnlyIf.equals) return false;
    }

    if (p.step.repeatable && p.instance && p.instance > 1 && !celdas[p.path]) return false;

    return true;
  });
}

/**
 * Exige que los pasos de un apartado se completen en orden: dado el
 * step_path que se quiere abrir/editar, busca -- entre los pasos VISIBLES de
 * ese mismo apartado (misma instancia de bloque) -- el más cercano por
 * delante que todavía no esté "terminado". Ese es el que hay que completar
 * antes. Devuelve null si no hay ninguno (el paso puede empezarse).
 *
 * Los reintentos de un mismo paso repetible (p. ej. Reporte Turnitin en
 * "Libro") no se exigen entre sí -- cada intento nuevo se agrega a mano
 * justo porque el anterior no pasó, así que encadenarlos rompería ese flujo.
 * Sí se exige el paso que viene antes de todos los reintentos.
 */
export function pasoQueFalta(
  visiblesDelApartado: ResolvedStep[],
  path: string,
  celdas: Record<string, Pick<MatrixCell, 'status'>>
): ResolvedStep | null {
  // Si este paso ya se tocó (no está "vacío"), no se re-bloquea -- se puede
  // seguir editando o completando lo que ya se había empezado, aunque el
  // anterior siga sin terminar (p. ej. datos de antes de que existiera esta
  // validación). El candado solo evita EMPEZAR uno nuevo fuera de orden.
  if (celdas[path] && celdas[path]!.status !== 'vacio') return null;

  const idx = visiblesDelApartado.findIndex((p) => p.path === path);
  if (idx <= 0) return null;
  const actual = visiblesDelApartado[idx];

  for (let j = idx - 1; j >= 0; j--) {
    const anterior = visiblesDelApartado[j];
    if (actual.step.repeatable && anterior.blockKey === actual.blockKey && anterior.step.key === actual.step.key) {
      continue;
    }
    return celdas[anterior.path]?.status === 'terminado' ? null : anterior;
  }

  return null;
}