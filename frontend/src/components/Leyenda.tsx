import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados';

export function Leyenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-[11px] text-slate-500">
      {ORDEN_ESTADOS.map((estado) => {
        const e = ESTADOS[estado];
        return (
          <span key={estado} className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded"
              style={{
                background: e.fondo,
                border: e.borde ? '0.5px solid rgba(0,0,0,.15)' : 'none',
              }}
            />
            {e.label}
          </span>
        );
      })}
    </div>
  );
}