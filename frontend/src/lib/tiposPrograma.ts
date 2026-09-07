import type { ProgramLevel, ProgramType } from '@shared/types';

/**
 * Idioma visual del tipo de programa: mismo patrón de swatch + etiqueta que
 * ya usa la leyenda de estados del tablero (ver lib/estados.ts, Leyenda.tsx).
 * Híbrido no tiene un solo color -- se pinta partido, mitad presencial y
 * mitad virtual, porque eso es literalmente lo que significa.
 */
export const TIPOS_PROGRAMA: Record<Exclude<ProgramType, 'hibrido'>, { label: string; color: string }> = {
  presencial: { label: 'Presencial con asignatura virtual', color: '#94A3B8' }, // slate-400
  virtual:    { label: 'Virtual',                            color: '#06B6D4' }, // marca-500
};

export const ORDEN_TIPOS: ProgramType[] = ['presencial', 'virtual', 'hibrido'];

export const ETIQUETA_TIPO: Record<ProgramType, string> = {
  presencial: 'Presencial con asignatura virtual',
  virtual: 'Virtual',
  hibrido: 'Híbrido',
};

/** Nivel académico de un programa virtual -- ver ProgramLevel */
export const NIVELES_PROGRAMA: { valor: ProgramLevel; etiqueta: string }[] = [
  { valor: 'pregrado', etiqueta: 'Pregrado' },
  { valor: 'posgrado', etiqueta: 'Posgrado' },
];

export const ETIQUETA_NIVEL: Record<ProgramLevel, string> = {
  pregrado: 'Pregrado',
  posgrado: 'Posgrado',
};
