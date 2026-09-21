import { ESTADOS, REQUIERE_ACCION, fechaCorta } from '../lib/estados';
import { etiquetaPaso } from '../lib/bloques';
import type { MatrixCell, ResolvedStep, StepDef } from '@shared/types';

function IconoCandado() {
  return (
    <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

interface Props {
  paso: StepDef;
  /** nombre a mostrar -- por defecto paso.label, pero el llamador puede pasar
   *  uno con el número de intento (ver etiquetaPaso) cuando el paso se repite
   *  dentro de su bloque */
  etiqueta?: string;
  celda?: MatrixCell;
  seleccionada: boolean;
  onClick: () => void;
  /** si no es null, este paso todavía no se puede tocar -- hay que completar
   *  antes el paso anterior del apartado (ver pasoQueFalta) */
  bloqueadoPor?: ResolvedStep | null;
}

export function CeldaProceso({ paso, etiqueta, celda, seleccionada, onClick, bloqueadoPor = null }: Props) {
  const estado = celda?.status ?? 'vacio';
  const e = ESTADOS[estado];
  // Un paso con customStates (p. ej. ISBN) reetiqueta sus estados -- el
  // color/fondo sigue siendo el del CellStatus real por debajo.
  const estadoLabel = paso.customStates?.find((s) => s.value === estado)?.label ?? e.label;
  const bloqueado = !!bloqueadoPor;

  // Los pasos de decisión muestran la respuesta en vez del estado -- el resto
  // siempre muestra en qué estado está (no solo la fecha, que puede faltar
  // aunque el paso ya no esté "sin iniciar", p. ej. pendiente jefe sin fecha).
  const pie = paso.isBranchPoint
    ? celda?.branch_value === true
      ? 'Sí hay ajustes'
      : celda?.branch_value === false
        ? 'No hay ajustes'
        : 'Sin decidir'
    : celda?.done_date
      ? `${estadoLabel} · ${fechaCorta(celda.done_date)} · ${celda.initials ?? ''}`
      : estadoLabel;

  const tituloBloqueo = bloqueadoPor
    ? `Completa primero "${etiquetaPaso(bloqueadoPor.step, bloqueadoPor.instance)}"`
    : undefined;

  return (
    <button
      onClick={() => { if (!bloqueado) onClick(); }}
      title={tituloBloqueo}
      aria-disabled={bloqueado}
      className={`min-w-[104px] shrink-0 p-2 rounded-lg text-left transition ${
        bloqueado
          ? 'cursor-not-allowed opacity-55 saturate-[0.4]'
          : 'cursor-pointer hover:shadow-md hover:brightness-95'
      }`}
      style={{
        background: e.fondo,
        border: e.borde ? '0.5px solid rgba(0,0,0,.12)' : '0.5px solid transparent',
        outline: seleccionada ? '2px solid #0891B2' : 'none',
        outlineOffset: 1,
      }}
    >
      <span
        className="flex items-center gap-1 text-[11px] leading-tight"
        style={{
          color: e.texto,
          fontWeight: REQUIERE_ACCION.includes(estado) ? 500 : 400,
        }}
      >
        {bloqueado && <IconoCandado />}
        {etiqueta ?? paso.label}
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