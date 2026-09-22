import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados';

function IconoCandado() {
  return (
    <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function Leyenda() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                    rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
        Estados
      </span>
      {ORDEN_ESTADOS.map((estado) => {
        const e = ESTADOS[estado];
        return (
          <span
            key={estado}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold
                       select-none shadow-sm"
            style={{
              background: e.fondo,
              color: e.texto,
              border: e.borde ? '1px solid rgba(0,0,0,.2)' : 'none',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.texto, opacity: 0.7 }} />
            {e.label}
          </span>
        );
      })}
      {/* No es un CellStatus (es a nivel de apartado completo, no de celda) -- ver
          bloquear/desbloquear en ModalApartado -- así que se agrega aparte del resto. */}
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold select-none
                   border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400"
      >
        <IconoCandado />
        Bloqueado (no aplica)
      </span>
    </div>
  );
}