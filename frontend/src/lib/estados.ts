import type { CellStatus } from '@shared/types';

export const ESTADOS: Record<CellStatus, {
  label: string;
  fondo: string;
  texto: string;
  textoSuave: string;
  borde: boolean;
}> = {
  vacio:            { label: 'Sin iniciar',      fondo: '#F1F0EC', texto: '#8A8578', textoSuave: '#A5A198', borde: false },
  pendiente_equipo: { label: 'Pendiente equipo', fondo: '#FFFFFF', texto: '#C0392B', textoSuave: '#6B6862', borde: true  },
  pendiente_jefe:   { label: 'Pendiente jefe',   fondo: '#F5D061', texto: '#A32D2D', textoSuave: '#6B5A22', borde: false },
  ajustes:          { label: 'En ajustes',       fondo: '#F5D061', texto: '#1F1B16', textoSuave: '#6B5A22', borde: false },
  por_revisar:      { label: 'Por revisar',      fondo: '#FFFFFF', texto: '#1F1B16', textoSuave: '#6B6862', borde: true  },
  terminado:        { label: 'Terminado',        fondo: '#3F7D5C', texto: '#FFFFFF', textoSuave: '#C8E0D4', borde: false },
};

export const ORDEN_ESTADOS = Object.keys(ESTADOS) as CellStatus[];

/** Estados que se muestran en negrita porque requieren acción */
export const REQUIERE_ACCION: CellStatus[] = ['pendiente_equipo', 'pendiente_jefe', 'ajustes'];

/** Color que representa a un bloque completo en el tablero del programa */
export function estadoDelBloque(estados: CellStatus[]): CellStatus {
  if (!estados.length || estados.every((e) => e === 'vacio')) return 'vacio';
  if (estados.every((e) => e === 'terminado')) return 'terminado';

  for (const p of ['pendiente_jefe', 'ajustes', 'por_revisar', 'pendiente_equipo'] as CellStatus[]) {
    if (estados.includes(p)) return p;
  }
  return 'pendiente_equipo';
}

/** '2026-02-18' → '18/02' */
export function fechaCorta(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
}