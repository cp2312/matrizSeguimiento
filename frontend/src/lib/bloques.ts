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

export interface InstanciaExtra {
  /** clave del apartado que abriría (p. ej. "video_contenido.2") */
  clave: string;
  /** nombre que tendría esa instancia (p. ej. "Video de contenido 2") */
  etiqueta: string;
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
 *    créditos, más las instancias extra de un bloque extensible que ya
 *    tienen algún dato guardado.
 *  - `siguientesExtra`: por cada bloque extensible con cupo libre, la
 *    próxima instancia oculta que se podría agregar (para el botón
 *    "+ Agregar video" de ApartadosAsignatura).
 */
export function separarGruposVisibles(
  grupos: Record<string, GrupoPasos>,
  celdas: Record<string, Pick<MatrixCell, 'branch_value'>>
): { visibles: Record<string, GrupoPasos>; siguientesExtra: InstanciaExtra[] } {
  const enUso = instanciasExtraEnUso(Object.values(grupos).flatMap((g) => g.pasos), celdas);

  const visibles: Record<string, GrupoPasos> = {};
  const siguientesExtra = new Map<string, InstanciaExtra>();

  for (const [clave, g] of Object.entries(grupos)) {
    const p0 = g.pasos[0];
    const esExtra = p0 && p0.instance !== null && !p0.garantizada;

    if (!esExtra || enUso.has(`${p0!.blockKey}.${p0!.instance}`)) {
      visibles[clave] = g;
    } else if (!siguientesExtra.has(p0!.blockKey)) {
      // La primera instancia oculta de este bloque, en orden -- las de más
      // allá esperan su turno (se agregan de a una).
      siguientesExtra.set(p0!.blockKey, { clave, etiqueta: g.titulo });
    }
  }

  return { visibles, siguientesExtra: [...siguientesExtra.values()] };
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