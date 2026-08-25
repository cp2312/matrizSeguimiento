import { PIPELINE_TEMPLATE } from '@shared/pipelineTemplate';

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