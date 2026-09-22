import { pasosVisibles } from '../lib/bloques';
import { ESTADOS, estadoDelBloque } from '../lib/estados';
import type { MatrixCell, ResolvedStep } from '@shared/types';

interface Props {
  titulo: string;
  pasos: ResolvedStep[];
  celdas: Record<string, MatrixCell>;
  /** este es el apartado que está abierto ahora mismo en la ventana flotante */
  activo?: boolean;
  onClick: () => void;
  /** si viene, es una instancia extra de un bloque extensible (ver
   *  BlockDef.repeatable.extensible) y se puede quitar con este botón */
  onEliminar?: () => void;
}

function IconoBasura() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/** Fila compacta que representa un apartado completo: su avance y un color que resume su estado */
export function ItemApartado({ titulo, pasos, celdas, activo = false, onClick, onEliminar }: Props) {
  const visibles = pasosVisibles(pasos, celdas);
  const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;
  const estado = estadoDelBloque(visibles.map((p) => celdas[p.path]?.status ?? 'vacio'));
  const e = ESTADOS[estado];

  return (
    <div
      className={`flex items-center gap-1 pl-3.5 pr-1.5 h-11 rounded-lg border transition-colors ${
        activo
          ? 'border-cyan-600 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-950/40'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
      }`}
    >
      <button onClick={onClick} className="flex flex-1 min-w-0 items-center gap-2.5 text-left">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: e.fondo, border: e.borde ? '0.5px solid rgba(0,0,0,.2)' : 'none' }}
        />
        <span className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-100 truncate">{titulo}</span>
        <span className="text-[11px] text-slate-400 shrink-0">{terminados} de {visibles.length}</span>
        <span className="text-slate-300 dark:text-slate-600 shrink-0">›</span>
      </button>
      {onEliminar && (
        <button
          type="button"
          onClick={(ev) => { ev.stopPropagation(); onEliminar(); }}
          title={`Quitar ${titulo}`}
          aria-label={`Quitar ${titulo}`}
          className="shrink-0 w-7 h-7 grid place-items-center rounded-md text-slate-300 dark:text-slate-600
                     hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <IconoBasura />
        </button>
      )}
    </div>
  );
}
