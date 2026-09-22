import { PIPELINE_TEMPLATE, pasosVisibles, etiquetaPaso, instanciasExtraEnUso } from '@shared/pipelineTemplate';
import type { MatrixCell, ResolvedStep } from '@shared/types';

// Mismas funciones que usa el backend para el avance, el color del tablero y
// la etiqueta de cada paso — una sola fuente de verdad de qué pasos aplican
// realmente y cómo se llaman.
export { pasosVisibles, etiquetaPaso };

export interface GrupoPasos {
  titulo: string;
  pasos: ResolvedStep[];
}

export interface InstanciaParaAgregar {
  /** clave del apartado que abriría (p. ej. "video_contenido.2"); para 'desbloquear-bloque' es solo el blockKey */
  clave: string;
  /** nombre a mostrar (p. ej. "Video de contenido 2", o "Infografía" para 'desbloquear-bloque') */
  etiqueta: string;
  blockKey: string;
  /** no aplica (0) cuando accion es 'desbloquear-bloque' -- ese llamado es a nivel de bloque, no de una instancia */
  instance: number;
  /**
   * 'agregar': instancia extra que todavía nunca existió (ver
   * BlockDef.repeatable.extensible) -- se agrega sola al guardar cualquier
   * paso suyo. 'restaurar': instancia garantizada por créditos que el equipo
   * había quitado a mano (ver subject_removed_instances) -- hace falta
   * llamar al endpoint de restaurar antes de poder volver a editarla.
   * 'desbloquear-bloque': TODAS las instancias garantizadas de este bloque
   * están quitadas -- el apartado completo está bloqueado, así que se
   * muestra una sola tarjeta en vez de una por instancia (ver
   * bloqueCompletamenteQuitado).
   */
  accion: 'agregar' | 'restaurar' | 'desbloquear-bloque';
}

// Solo "Video de contenido" se renombra a "Video tutorial" -- "Video de
// bienvenida" mantiene siempre su nombre, lo grabe quien lo grabe.
const BLOQUES_VIDEO = new Set(['video_contenido']);

/**
 * Agrupa los pasos resueltos de una asignatura por bloque e instancia (p. ej. "ovas.1", "ovas.2").
 * Cuando `videoPorDocente` es true, "Video de contenido" se renombra a "Video tutorial"
 * (asignaturas donde el video lo graba el profesor en vez del equipo de producción).
 *
 * Un paso repetible DENTRO de su bloque (p. ej. los reintentos del reporte
 * Turnitin en "Libro") no forma su propio grupo -- `p.instance` ahí es el
 * número de intento, no una instancia de bloque, así que sus repeticiones se
 * quedan agrupadas con el resto del bloque (ver StepDef.repeatable).
 */
export function agruparPasos(pasos: ResolvedStep[], opciones?: { videoPorDocente?: boolean }): Record<string, GrupoPasos> {
  const videoPorDocente = opciones?.videoPorDocente ?? false;

  return pasos.reduce<Record<string, GrupoPasos>>((acc, p) => {
    const instanciaDeBloque = p.instance && !p.step.repeatable ? p.instance : null;
    const clave = instanciaDeBloque ? `${p.blockKey}.${instanciaDeBloque}` : p.blockKey;
    const titulo = videoPorDocente && BLOQUES_VIDEO.has(p.blockKey)
      ? (instanciaDeBloque ? `Video tutorial ${instanciaDeBloque}` : 'Video tutorial')
      : p.blockLabel;

    (acc[clave] ??= { titulo, pasos: [] }).pasos.push(p);
    return acc;
  }, {});
}

/**
 * Separa los apartados de `agruparPasos` (sin filtrar) en dos:
 *  - `visibles`: los que se muestran como tarjeta -- todo lo garantizado por
 *    créditos (y no quitado a mano), más las instancias extra de un bloque
 *    extensible que ya tienen algún dato guardado.
 *  - `paraAgregar`: tarjetas punteadas para traer de vuelta una instancia que
 *    no se ve ahora -- la próxima instancia extra oculta de cada bloque
 *    extensible con cupo libre (accion 'agregar'), más las instancias
 *    garantizadas que el equipo quitó a mano (accion 'restaurar', ver
 *    `quitadas`). Si TODAS las garantizadas de un mismo bloque están
 *    quitadas, en vez de una tarjeta de "restaurar" por cada una se junta en
 *    una sola de accion 'desbloquear-bloque' -- así se ve claro que el
 *    apartado completo está bloqueado, no que sencillamente hay cupos
 *    sueltos para agregar.
 */
export function separarGruposVisibles(
  grupos: Record<string, GrupoPasos>,
  celdas: Record<string, Pick<MatrixCell, 'branch_value'>>,
  quitadas: ReadonlySet<string> = new Set()
): { visibles: Record<string, GrupoPasos>; paraAgregar: InstanciaParaAgregar[] } {
  const enUso = instanciasExtraEnUso(Object.values(grupos).flatMap((g) => g.pasos), celdas);

  const visibles: Record<string, GrupoPasos> = {};
  const siguienteExtraPorBloque = new Map<string, InstanciaParaAgregar>();
  const restaurablesPorBloque = new Map<string, InstanciaParaAgregar[]>();
  const garantizadasTotalPorBloque = new Map<string, number>();

  for (const [clave, g] of Object.entries(grupos)) {
    const p0 = g.pasos[0];

    if (!p0 || p0.instance === null) {
      visibles[clave] = g;
      continue;
    }

    if (p0.garantizada) {
      garantizadasTotalPorBloque.set(p0.blockKey, (garantizadasTotalPorBloque.get(p0.blockKey) ?? 0) + 1);
    }

    const claveInstancia = `${p0.blockKey}.${p0.instance}`;

    if (quitadas.has(claveInstancia)) {
      const lista = restaurablesPorBloque.get(p0.blockKey) ?? [];
      lista.push({ clave, etiqueta: g.titulo, blockKey: p0.blockKey, instance: p0.instance, accion: 'restaurar' });
      restaurablesPorBloque.set(p0.blockKey, lista);
      continue;
    }

    const esExtra = !p0.garantizada;
    if (!esExtra || enUso.has(claveInstancia)) {
      visibles[clave] = g;
    } else if (!siguienteExtraPorBloque.has(p0.blockKey)) {
      // La primera instancia oculta de este bloque, en orden -- las de más
      // allá esperan su turno (se agregan de a una).
      siguienteExtraPorBloque.set(p0.blockKey, { clave, etiqueta: g.titulo, blockKey: p0.blockKey, instance: p0.instance, accion: 'agregar' });
    }
  }

  const paraAgregar: InstanciaParaAgregar[] = [];
  for (const [blockKey, lista] of restaurablesPorBloque) {
    const totalGarantizadas = garantizadasTotalPorBloque.get(blockKey) ?? 0;
    if (totalGarantizadas > 0 && lista.length === totalGarantizadas) {
      const blockLabel = PIPELINE_TEMPLATE.find((b) => b.key === blockKey)?.label ?? blockKey;
      paraAgregar.push({ clave: blockKey, etiqueta: blockLabel, blockKey, instance: 0, accion: 'desbloquear-bloque' });
    } else {
      paraAgregar.push(...lista);
    }
  }
  paraAgregar.push(...siguienteExtraPorBloque.values());

  return { visibles, paraAgregar };
}

const ABREVIATURAS: Record<string, string> = {
  derechos: 'Der',
  entregables: 'Entr',
  contrato: 'Contr',
  libro: 'Libro',
  unidad_grafica: 'UG',
  estructura: 'Estr',
  rutas: 'Rutas',
  ovas: 'OVAs',
  podcast: 'Pod',
  video_bienvenida: 'V.bienv',
  video_contenido: 'Videos',
  infografia: 'Info',
  cuestionario_final: 'Cuest',
  guias: 'Guías',
  contenidos_apoyo: 'Apoyo',
  syllabus: 'Syll',
  montaje_plataforma: 'Mont',
  ruta_visual: 'R.visual',
  revision_final: 'Rev',
};

/** Los bloques del proceso con etiqueta corta para el tablero */
export const COLUMNAS_TABLERO = PIPELINE_TEMPLATE.map((b) => ({
  key: b.key,
  label: b.label,
  corta: ABREVIATURAS[b.key] ?? b.label.slice(0, 4),
}));