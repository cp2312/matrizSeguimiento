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
}

/** Fila compacta que representa un apartado completo: su avance y un color que resume su estado */
export function ItemApartado({ titulo, pasos, celdas, activo = false, onClick }: Props) {
  const visibles = pasosVisibles(pasos, celdas);
  const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;
  const estado = estadoDelBloque(visibles.map((p) => celdas[p.path]?.status ?? 'vacio'));
  const e = ESTADOS[estado];

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3.5 h-11 rounded-lg text-left border transition-colors ${
        activo ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: e.fondo, border: e.borde ? '0.5px solid rgba(0,0,0,.2)' : 'none' }}
      />
      <span className="flex-1 min-w-0 text-[13px] text-slate-800 truncate">{titulo}</span>
      <span className="text-[11px] text-slate-400 shrink-0">{terminados} de {visibles.length}</span>
      <span className="text-slate-300 shrink-0">›</span>
    </button>
  );
}
