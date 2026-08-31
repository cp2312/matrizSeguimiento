import { PIPELINE_TEMPLATE, pasosVisibles } from '@shared/pipelineTemplate';
import type { ResolvedStep } from '@shared/types';

// Misma función que usa el backend para el avance y el color del tablero —
// una sola fuente de verdad de qué pasos aplican realmente.
export { pasosVisibles };

export interface GrupoPasos {
  titulo: string;
  pasos: ResolvedStep[];
}

const BLOQUES_VIDEO = new Set(['video_bienvenida', 'video_contenido']);

/**
 * Agrupa los pasos resueltos de una asignatura por bloque e instancia (p. ej. "ovas.1", "ovas.2").
 * Cuando `videoPorDocente` es true, los bloques de video se renombran a "Video tutorial"
 * (asignaturas donde el video lo graba el profesor en vez del equipo de producción).
 */
export function agruparPasos(pasos: ResolvedStep[], opciones?: { videoPorDocente?: boolean }): Record<string, GrupoPasos> {
  const videoPorDocente = opciones?.videoPorDocente ?? false;

  return pasos.reduce<Record<string, GrupoPasos>>((acc, p) => {
    const clave = p.instance ? `${p.blockKey}.${p.instance}` : p.blockKey;
    const titulo = videoPorDocente && BLOQUES_VIDEO.has(p.blockKey)
      ? (p.instance ? `Video tutorial ${p.instance}` : 'Video tutorial')
      : p.blockLabel;

    (acc[clave] ??= { titulo, pasos: [] }).pasos.push(p);
    return acc;
  }, {});
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