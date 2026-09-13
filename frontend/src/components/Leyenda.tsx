import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados';

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
    </div>
  );
}