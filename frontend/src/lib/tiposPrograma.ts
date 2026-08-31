import type { ProgramType } from '@shared/types';

/**
 * Idioma visual del tipo de programa: mismo patrón de swatch + etiqueta que
 * ya usa la leyenda de estados del tablero (ver lib/estados.ts, Leyenda.tsx).
 * Híbrido no tiene un solo color -- se pinta partido, mitad presencial y
 * mitad virtual, porque eso es literalmente lo que significa.
 */
export const TIPOS_PROGRAMA: Record<Exclude<ProgramType, 'hibrido'>, { label: string; color: string }> = {
  presencial: { label: 'Presencial', color: '#94A3B8' }, // slate-400
  virtual:    { label: 'Virtual',    color: '#06B6D4' }, // marca-500
};

export const ORDEN_TIPOS: ProgramType[] = ['presencial', 'virtual', 'hibrido'];

export const ETIQUETA_TIPO: Record<ProgramType, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Híbrido',
};
