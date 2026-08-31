import { ESTADOS, REQUIERE_ACCION, fechaCorta } from '../lib/estados';
import type { MatrixCell, StepDef } from '@shared/types';

interface Props {
  paso: StepDef;
  celda?: MatrixCell;
  seleccionada: boolean;
  onClick: () => void;
}

export function CeldaProceso({ paso, celda, seleccionada, onClick }: Props) {
  const estado = celda?.status ?? 'vacio';
  const e = ESTADOS[estado];

  // Los pasos de decisión muestran la respuesta en vez de la fecha
  const pie = paso.isBranchPoint
    ? celda?.branch_value === true
      ? 'Sí hay ajustes'
      : celda?.branch_value === false
        ? 'No hay ajustes'
        : 'Sin decidir'
    : celda?.done_date
      ? `${fechaCorta(celda.done_date)} · ${celda.initials ?? ''}`
      : '—';

  return (
    <button
      onClick={onClick}
      className="min-w-[104px] shrink-0 p-2 rounded-lg text-left transition-shadow"
      style={{
        background: e.fondo,
        border: e.borde ? '0.5px solid rgba(0,0,0,.12)' : '0.5px solid transparent',
        outline: seleccionada ? '2px solid #0891B2' : 'none',
        outlineOffset: 1,
      }}
    >
      <span
        className="block text-[11px] leading-tight"
        style={{
          color: e.texto,
          fontWeight: REQUIERE_ACCION.includes(estado) ? 500 : 400,
        }}
      >
        {paso.label}
      </span>
      <span className="block text-[10px] mt-1" style={{ color: e.textoSuave }}>
        {pie}
      </span>
      {celda?.comment && (
        <span className="block text-[10px] mt-0.5 truncate" style={{ color: e.textoSuave }}>
          {celda.comment}
        </span>
      )}
    </button>
  );
}