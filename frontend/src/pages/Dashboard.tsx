import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { Layout } from '../components/Layout';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando, Vacio } from '../components/ui/Estado';
import { ESTADOS, ORDEN_ESTADOS, fechaCorta } from '../lib/estados';
import { ETIQUETA_TIPO, ORDEN_TIPOS } from '../lib/tiposPrograma';
import type { AlertaResumen, CellStatus, DashboardResumen, ProgramType, VirtualizacionResumen } from '@shared/types';

// ---------------------------------------------------------------------------
//  Iconos -- set mínimo propio en SVG (trazo, sin relleno) para no sumar una
//  dependencia nueva solo por esto; mismo patrón que ya usa el resto de la
//  app (iconos inline, ver Layout.tsx / PanelCelda.tsx).
// ---------------------------------------------------------------------------
type IconoProps = { className?: string };

function Icono({ children, className = 'w-5 h-5' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

const IconoPrograma = ({ className }: IconoProps) => (
  <Icono className={className}>
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <rect x="8" y="6" width="3" height="3" />
    <rect x="13" y="6" width="3" height="3" />
    <rect x="8" y="11" width="3" height="3" />
    <rect x="13" y="11" width="3" height="3" />
    <rect x="9" y="17" width="6" height="5" />
  </Icono>
);

const IconoAsignatura = ({ className }: IconoProps) => (
  <Icono className={className}>
    <path d="M3 5c3-1.5 6-1.5 9 0v14c-3-1.5-6-1.5-9 0V5Z" />
    <path d="M21 5c-3-1.5-6-1.5-9 0v14c3-1.5 6-1.5 9 0V5Z" />
  </Icono>
);

const IconoDocente = ({ className }: IconoProps) => (
  <Icono className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icono>
);

const IconoCandado = ({ className }: IconoProps) => (
  <Icono className={className}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icono>
);

const IconoCampana = ({ className }: IconoProps) => (
  <Icono className={className}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Icono>
);

const IconoTendencia = ({ className }: IconoProps) => (
  <Icono className={className}>
    <polyline points="3 17 9 11 13 15 21 6" />
    <polyline points="15 6 21 6 21 12" />
  </Icono>
);

const IconoPastel = ({ className }: IconoProps) => (
  <Icono className={className}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="12" x2="12" y2="3" />
    <line x1="12" y1="12" x2="19" y2="7" />
  </Icono>
);

const IconoCapas = ({ className }: IconoProps) => (
  <Icono className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Icono>
);

const IconoCheck = ({ className }: IconoProps) => (
  <Icono className={className}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8 12 11 15 16 9" />
  </Icono>
);

const IconoReloj = ({ className }: IconoProps) => (
  <Icono className={className}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </Icono>
);

const IconoBandera = ({ className }: IconoProps) => (
  <Icono className={className}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="3" />
  </Icono>
);

const IconoAlerta = ({ className }: IconoProps) => (
  <Icono className={className}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17.01" x2="12.01" y2="17.01" />
  </Icono>
);

const IconoCalendario = ({ className }: IconoProps) => (
  <Icono className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Icono>
);

const IconoIntercambio = ({ className }: IconoProps) => (
  <Icono className={className}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Icono>
);

const IconoActualizar = ({ className }: IconoProps) => (
  <Icono className={className}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Icono>
);

type IconoComponente = (p: IconoProps) => React.ReactElement;

// ---------------------------------------------------------------------------
//  Animación -- todo lo que "crece" en el dashboard (anillo, barras, números,
//  la línea de tendencia) arranca en cero y llega a su valor real con una
//  transición, en vez de aparecer ya completo. Respeta prefers-reduced-motion
//  (ver index.css para la variante CSS; acá se corta la animación por JS).
// ---------------------------------------------------------------------------
function prefiereMenosMovimiento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Número que cuenta de 0 hasta `valor` apenas se monta (o cambia `valor`,
 *  p. ej. tras "Actualizar") -- usado en los StatTile. */
function useConteo(valor: number, duracionMs = 800): number {
  const [n, setN] = useState(() => (prefiereMenosMovimiento() ? valor : 0));
  useEffect(() => {
    if (prefiereMenosMovimiento()) { setN(valor); return; }
    let frame = 0;
    const inicio = performance.now();
    function tick(ahora: number) {
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      const avance = 1 - Math.pow(1 - t, 3); // ease-out cúbico
      setN(Math.round(valor * avance));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracionMs]);
  return n;
}

/** true dos frames después del montaje (o de que cambie `dep`) -- el truco
 *  clásico para que una barra arranque en 0 y la transición de ancho/alto de
 *  CSS sí se note al pasar al valor real, en vez de aparecer ya llena. */
function useListoParaAnimar(dep: unknown): boolean {
  const [listo, setListo] = useState(prefiereMenosMovimiento);
  useEffect(() => {
    if (prefiereMenosMovimiento()) { setListo(true); return; }
    setListo(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setListo(true)));
    return () => cancelAnimationFrame(id);
  }, [dep]);
  return listo;
}

// ---------------------------------------------------------------------------
//  Color por categoría -- cada entidad del dashboard (programa, asignatura,
//  docente, alerta...) tiene siempre el mismo color en toda la página, para
//  que el color funcione como identidad y no solo como decoración. Mismo
//  formato ya usado por COLOR_PRIORIDAD (claro: fondo 100/texto 700, oscuro:
//  fondo al 15% de opacidad/texto 300).
// ---------------------------------------------------------------------------
const COLOR_BADGE = {
  cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  teal: 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
} as const;
type ColorBadge = keyof typeof COLOR_BADGE;

function IconBadge({ color, icon: Icon, size = 'normal' }: { color: ColorBadge; icon: IconoComponente; size?: 'normal' | 'chico' }) {
  const dimensiones = size === 'chico' ? 'w-7 h-7' : 'w-10 h-10';
  const iconoSize = size === 'chico' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <span className={`inline-flex items-center justify-center shrink-0 rounded-xl ${dimensiones} ${COLOR_BADGE[color]}`}>
      <Icon className={iconoSize} />
    </span>
  );
}

/** Encabezado de sección: icono con color de la categoría + título + subtítulo
 *  opcional -- mismo patrón repetido en cada tarjeta del dashboard, para que
 *  cada una se reconozca de un vistazo por su color/icono antes de leer el
 *  título. */
function TituloSeccion({
  icon, color, titulo, subtitulo, accion,
}: {
  icon: IconoComponente;
  color: ColorBadge;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <IconBadge color={color} icon={icon} size="chico" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
        {subtitulo && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitulo}</p>}
      </div>
      {accion}
    </div>
  );
}

function StatTile({
  etiqueta, valor, icon, color, retrasoMs = 0,
}: { etiqueta: string; valor: number; icon: IconoComponente; color: ColorBadge; retrasoMs?: number }) {
  const mostrado = useConteo(valor);
  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 transition-shadow hover:shadow-md animar-entrada"
      style={{ animationDelay: `${retrasoMs}ms` }}
    >
      <div className="flex items-center gap-3">
        <IconBadge color={color} icon={icon} />
        <div className="min-w-0">
          <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{etiqueta}</p>
          <p className="mt-0.5 text-[22px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">{mostrado}</p>
        </div>
      </div>
    </div>
  );
}

/** Anillo de progreso para el avance global -- la pieza visual "firma" del
 *  dashboard: el único número que importa más que todos los demás, de un
 *  vistazo, sin tener que leer una barra o una tabla. */
function AnilloAvance({ porcentaje, size = 108 }: { porcentaje: number; size?: number }) {
  const mostrado = useConteo(Math.max(0, Math.min(100, porcentaje)), 1100);
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = (mostrado / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
        <circle cx="56" cy="56" r={r} strokeWidth={10} fill="none" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx="56" cy="56" r={r} strokeWidth={10} fill="none" strokeLinecap="round"
          className="stroke-marca-500 dark:stroke-marca-400"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[24px] font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">{mostrado}%</span>
      </div>
    </div>
  );
}

/** Barra de magnitud (un solo color, más lleno = más avance) -- mismo patrón
 *  que ya usa el avance de una asignatura en el tablero del programa, con
 *  líneas de grilla en 25/50/75% (recesivas, detrás del relleno) para que
 *  se lea como una escala de verdad y no solo una barra suelta. El color se
 *  puede variar por sección (ver COLOR_BARRA) para que cada lista se
 *  reconozca junto con el icono de su tarjeta. */
function BarraAvance({
  porcentaje, className = '', color = 'bg-marca-500 dark:bg-marca-400',
}: { porcentaje: number; className?: string; color?: string }) {
  const listo = useListoParaAnimar(porcentaje);
  return (
    <div className={`relative rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ${className}`}>
      {[25, 50, 75].map((m) => (
        <div key={m} className="absolute top-0 bottom-0 w-px bg-white/70 dark:bg-black/25" style={{ left: `${m}%` }} />
      ))}
      <div
        className={`relative h-full rounded-full transition-[width] duration-700 ease-out ${color}`}
        style={{ width: `${listo ? porcentaje : 0}%` }}
      />
    </div>
  );
}

/** Fila de una lista de avance (apartado o programa): etiqueta + barra + %.
 *  Las listas vienen ordenadas de menor a mayor avance, para que lo más
 *  atrasado salte a la vista de una vez, arriba de todo. */
function FilaAvance({
  etiqueta, detalle, porcentaje, to, color,
}: { etiqueta: React.ReactNode; detalle?: string; porcentaje: number; to?: string; color?: string }) {
  const contenido = (
    <>
      <div className="w-40 sm:w-52 shrink-0 min-w-0">
        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{etiqueta}</p>
        {detalle && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{detalle}</p>}
      </div>
      <BarraAvance porcentaje={porcentaje} className="flex-1 h-2" color={color} />
      <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {porcentaje}%
      </span>
    </>
  );

  return to ? (
    <Link
      to={to}
      className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
    >
      {contenido}
    </Link>
  ) : (
    <div className="flex items-center gap-3 py-2">{contenido}</div>
  );
}

/** Eje horizontal (0/25/50/75/100%) para las listas de FilaAvance -- usa
 *  exactamente el mismo ancho de columnas que cada fila, para quedar
 *  alineado con las barras de abajo sin importar el tamaño de pantalla. */
function EjeAvance() {
  return (
    <div className="flex items-center gap-3 pb-1.5 mb-1">
      <div className="w-40 sm:w-52 shrink-0" />
      <div className="relative flex-1 h-3">
        {[0, 25, 50, 75, 100].map((m) => (
          <span
            key={m}
            className={`absolute top-0 text-[9px] text-slate-400 dark:text-slate-500 ${
              m === 0 ? 'left-0' : m === 100 ? 'right-0' : '-translate-x-1/2'
            }`}
            style={m !== 0 && m !== 100 ? { left: `${m}%` } : undefined}
          >
            {m}%
          </span>
        ))}
      </div>
      <div className="w-10 shrink-0" />
    </div>
  );
}

/** Pastilla de filtro -- mismo patrón visual ya usado en Programas
 *  (ver ListadoProgramas.tsx), repetido aquí en vez de compartido porque no
 *  está exportado de allá. */
function FiltroPildora({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-3 rounded-full text-[12px] font-medium transition-colors ${
        activo
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}

/** Todos los pasos "que aplican" de toda la app, repartidos por estado --
 *  barra apilada horizontal (proporción) + leyenda con el conteo de cada uno.
 *  Mismos colores que ya usa el tablero y la Leyenda (ver lib/estados.ts). */
function PorEstado({ porEstado }: { porEstado: Record<CellStatus, number> }) {
  const total = ORDEN_ESTADOS.reduce((acc, e) => acc + porEstado[e], 0);
  const segmentos = ORDEN_ESTADOS
    .map((estado) => ({ estado, cantidad: porEstado[estado], pct: total ? (porEstado[estado] / total) * 100 : 0 }))
    .filter((s) => s.cantidad > 0);

  const listo = useListoParaAnimar(total);

  if (total === 0) {
    return <p className="text-[12px] text-slate-400 dark:text-slate-500">Sin pasos para mostrar.</p>;
  }

  return (
    <div>
      <div className="flex h-6 w-full rounded-full overflow-hidden gap-[2px] bg-slate-100 dark:bg-slate-800">
        {segmentos.map((s) => {
          const e = ESTADOS[s.estado];
          return (
            <div
              key={s.estado}
              className="h-full flex items-center justify-center overflow-hidden transition-[width] duration-700 ease-out"
              style={{ width: `${listo ? s.pct : 0}%`, background: e.fondo }}
              title={`${e.label}: ${s.cantidad} (${Math.round(s.pct)}%)`}
            >
              {s.pct >= 8 && (
                <span className="text-[10px] font-semibold px-1" style={{ color: e.texto }}>
                  {Math.round(s.pct)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segmentos.map((s) => {
          const e = ESTADOS[s.estado];
          return (
            <span key={s.estado} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: e.fondo, border: e.borde ? '1px solid rgba(0,0,0,.2)' : 'none' }}
              />
              {e.label} <span className="text-slate-400 dark:text-slate-500">({s.cantidad})</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Redondea `valor` hacia arriba a un número "lindo" (1/2/2.5/5/10 × 10^n),
 *  para que las líneas de la grilla del gráfico queden en números redondos. */
function techoLindo(valor: number): number {
  if (valor <= 0) return 1;
  const magnitud = Math.pow(10, Math.floor(Math.log10(valor)));
  const normalizado = valor / magnitud;
  const pasos = [1, 2, 2.5, 5, 10];
  const paso = pasos.find((p) => p >= normalizado) ?? 10;
  return paso * magnitud;
}

/** Cuántos pasos pasaron a "terminado" cada semana, últimas 8 semanas --
 *  línea + área (una sola serie, ver choosing-a-form: "trend over time").
 *  Grilla recesiva, trazo de 2px, marcador con anillo de superficie, y un
 *  solo valor directo en el último punto (la semana en curso). */
function GraficoTendencia({ datos }: { datos: { semana: string; terminados: number }[] }) {
  // Los hooks de acá abajo necesitan correr siempre, aunque no haya datos
  // (no se puede saltar un hook con un "return" antes) -- por eso se arma un
  // dato de relleno cuando viene vacío, y el "return null" real queda hasta
  // el final, después de declarar todos los hooks.
  const vacio = datos.length === 0;
  const datosSeguros = vacio ? [{ semana: '', terminados: 0 }] : datos;

  const W = 700;
  const H = 190;
  const M = { top: 18, right: 14, bottom: 26, left: 28 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = datosSeguros.length;

  const techo = techoLindo(Math.max(1, ...datosSeguros.map((d) => d.terminados)));
  const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => M.top + plotH - (v / techo) * plotH;

  const puntos = datosSeguros.map((d, i) => ({ ...d, cx: x(i), cy: y(d.terminados) }));
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const base = M.top + plotH;
  const area = `${linea} L${puntos[n - 1].cx.toFixed(1)},${base} L${puntos[0].cx.toFixed(1)},${base} Z`;

  const ticksY = [0, techo / 2, techo];

  const lineaRef = useRef<SVGPathElement>(null);
  const listo = useListoParaAnimar(linea);

  // La línea "se dibuja" de izquierda a derecha: se mide su largo real y se
  // anima el stroke-dashoffset de ese largo hasta 0 (truco clásico de SVG).
  useEffect(() => {
    const el = lineaRef.current;
    if (!el || vacio || prefiereMenosMovimiento()) return;
    const largo = el.getTotalLength();
    el.style.transition = 'none';
    el.style.strokeDasharray = `${largo}`;
    el.style.strokeDashoffset = `${largo}`;
    el.getBoundingClientRect(); // fuerza reflow para que el navegador registre el estado inicial
    const id = requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.strokeDashoffset = '0';
    });
    return () => cancelAnimationFrame(id);
  }, [linea, vacio]);

  if (vacio) return null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[170px]" role="img" aria-label="Pasos terminados por semana">
      {ticksY.map((t) => (
        <g key={t}>
          <line
            x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)}
            className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1}
          />
          <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 dark:fill-slate-500 text-[9px]">
            {Math.round(t)}
          </text>
        </g>
      ))}

      <path d={area} className="fill-marca-500 dark:fill-marca-400 transition-opacity duration-700" opacity={listo ? 0.1 : 0} />
      <path ref={lineaRef} d={linea} fill="none" className="stroke-marca-500 dark:stroke-marca-400" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {puntos.map((p, i) => (
        <g key={p.semana} style={{ opacity: listo ? 1 : 0, transition: `opacity 400ms ease-out ${150 + i * 70}ms` }}>
          <circle cx={p.cx} cy={p.cy} r={4} className="fill-marca-500 dark:fill-marca-400 stroke-white dark:stroke-slate-900" strokeWidth={2}>
            <title>{`Semana del ${fechaCorta(p.semana)}: ${p.terminados} terminados`}</title>
          </circle>
          {i === n - 1 && (
            <text x={p.cx} y={Math.max(12, p.cy - 10)} textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 text-[11px] font-semibold">
              {p.terminados}
            </text>
          )}
          <text x={p.cx} y={H - 8} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[9px]">
            {fechaCorta(p.semana)}
          </text>
        </g>
      ))}
    </svg>
  );
}

const ETIQUETA_TIPO_ALERTA: Record<AlertaResumen['tipo'], string> = {
  fecha_limite: 'Fecha límite',
  contrato: 'Contrato',
  libro: 'Entrega de libro',
};

/** Fechas límite, contratos y entregas de libro por vencer o ya vencidos --
 *  ordenadas por urgencia (lo más vencido primero, ver backend). Vencida =
 *  rojo; por vencer = ámbar; mismos colores de "atención" que ya usa el
 *  resto de la app para pendientes/ajustes. */
function Alertas({ alertas }: { alertas: AlertaResumen[] }) {
  if (alertas.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 dark:text-slate-500">
        🎉 Sin fechas límite, contratos ni entregas de libro por vencer en los próximos días.
      </p>
    );
  }

  return (
    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mx-2">
      {alertas.map((a, i) => {
        const vencida = a.diasRestantes < 0;
        return (
          <Link
            key={i}
            to={`/asignaturas/${a.subjectId}?apartado=${encodeURIComponent(a.apartado)}`}
            className="flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <span className={`shrink-0 w-2 h-2 rounded-full ${vencida ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">
                {a.etiqueta}
                <span className="ml-1.5 text-[11px] font-normal text-slate-400 dark:text-slate-500">
                  {ETIQUETA_TIPO_ALERTA[a.tipo]}
                </span>
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                {a.asignatura} · {a.programa}
              </p>
            </div>
            <span
              className={`shrink-0 text-[12px] font-semibold whitespace-nowrap ${
                vencida ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {vencida
                ? `Venció hace ${Math.abs(a.diasRestantes)} ${Math.abs(a.diasRestantes) === 1 ? 'día' : 'días'}`
                : a.diasRestantes === 0
                  ? 'Hoy'
                  : `En ${a.diasRestantes} ${a.diasRestantes === 1 ? 'día' : 'días'}`}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

const ETIQUETA_PRIORIDAD: Record<'alta' | 'media' | 'baja', string> = {
  alta: 'Alta', media: 'Media', baja: 'Baja',
};
const COLOR_PRIORIDAD: Record<'alta' | 'media' | 'baja', string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  baja: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function PrioridadBadge({ prioridad }: { prioridad: 'alta' | 'media' | 'baja' }) {
  return (
    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${COLOR_PRIORIDAD[prioridad]}`}>
      {ETIQUETA_PRIORIDAD[prioridad]}
    </span>
  );
}

/** Plan de virtualización: qué tan virtualizados están los espacios
 *  académicos (asignatura con el 100% de sus pasos en "Terminado"), qué
 *  falta, qué ya se puede ofrecer entre seccionales y en qué orden
 *  priorizar el trabajo según la fecha estimada de apertura de cada
 *  programa (ver "Fecha estimada de apertura" al crear/editar un programa). */
function PlanVirtualizacion({ datos }: { datos: VirtualizacionResumen }) {
  const { espacios, programasPendientes, necesidadesPendientes, disponiblesIntercambio, programasPorPrioridad } = datos;
  const porcentajeVirtualizado = espacios.total ? Math.round((espacios.virtualizados / espacios.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '500ms' }}>
        <TituloSeccion
          icon={IconoAlerta}
          color="amber"
          titulo="Programas y espacios académicos que requieren virtualización"
          subtitulo={`${espacios.enProceso + espacios.proyectados} de ${espacios.total} espacios académicos, repartidos en ${programasPendientes.length} ${programasPendientes.length === 1 ? 'programa' : 'programas'}`}
        />
        {programasPendientes.length === 0 ? (
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            Todos los programas están virtualizados al 100%.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {programasPendientes.map((p) => (
              <Link
                key={p.id}
                to={`/programas/${p.id}`}
                className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</span>
                <span className="shrink-0 text-[12px] text-slate-500 dark:text-slate-400">
                  {p.pendientes} de {p.totalAsignaturas} por virtualizar
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '550ms' }}>
        <TituloSeccion
          icon={IconoCheck}
          color="emerald"
          titulo="Espacios académicos virtualizados (100%), en proceso y proyectados"
          subtitulo={'"Virtualizado" = asignatura con el 100% de sus pasos en "Terminado"'}
        />
        <div className="grid grid-cols-3 gap-3">
          <StatTile etiqueta="Virtualizados (100%)" valor={espacios.virtualizados} icon={IconoCheck} color="emerald" retrasoMs={580} />
          <StatTile etiqueta="En proceso" valor={espacios.enProceso} icon={IconoReloj} color="amber" retrasoMs={620} />
          <StatTile etiqueta="Proyectados" valor={espacios.proyectados} icon={IconoBandera} color="slate" retrasoMs={660} />
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '600ms' }}>
        <TituloSeccion
          icon={IconoTendencia}
          color="emerald"
          titulo="Avance de los planes de virtualización"
          subtitulo={`${espacios.virtualizados} de ${espacios.total} espacios académicos ya virtualizados`}
        />
        <div className="flex items-center gap-3">
          <BarraAvance porcentaje={porcentajeVirtualizado} className="flex-1 h-2.5" color="bg-emerald-500 dark:bg-emerald-400" />
          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {porcentajeVirtualizado}%
          </span>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '650ms' }}>
        <TituloSeccion
          icon={IconoIntercambio}
          color="blue"
          titulo={<>Espacios académicos disponibles para intercambio entre seccionales <span className="font-normal text-slate-400 dark:text-slate-500">(estado virtualizados)</span></>}
          subtitulo="Ya virtualizados al 100% -- listos para ofrecer en otra seccional"
        />
        {disponiblesIntercambio.length === 0 ? (
          <p className="text-[12px] text-slate-400 dark:text-slate-500">Todavía no hay ninguno al 100%.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mx-2">
            {disponiblesIntercambio.map((a) => (
              <Link
                key={a.id}
                to={`/asignaturas/${a.id}`}
                className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{a.name}</span>
                <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 truncate">{a.programName}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '700ms' }}>
        <TituloSeccion
          icon={IconoAlerta}
          color="rose"
          titulo="Necesidades de virtualización pendientes"
          subtitulo="Espacios académicos con menor avance, de toda la app (tope 10)"
        />
        {necesidadesPendientes.length === 0 ? (
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            Todos los espacios académicos están virtualizados al 100%.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {necesidadesPendientes.map((a) => (
              <Link
                key={a.id}
                to={`/asignaturas/${a.id}`}
                className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{a.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{a.programName}</p>
                </div>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {a.porcentaje}%
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '750ms' }}>
        <TituloSeccion
          icon={IconoCalendario}
          color="fuchsia"
          titulo="Estado y nivel de priorización de cada proceso: fecha estimada de apertura"
          subtitulo="Del más próximo a abrir al más lejano"
        />
        {programasPorPrioridad.length === 0 ? (
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            Ningún programa tiene todavía una fecha estimada de apertura -- se agrega al editarlo en
            Programas.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {programasPorPrioridad.map((p) => (
              <Link
                key={p.id}
                to={`/programas/${p.id}`}
                className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <span className="w-16 shrink-0 text-[12px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {p.fechaApertura}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {p.asignaturas} {p.asignaturas === 1 ? 'asignatura' : 'asignaturas'}
                  </p>
                </div>
                <BarraAvance porcentaje={p.porcentaje} className="w-24 h-2 shrink-0 hidden sm:block" color="bg-fuchsia-500 dark:bg-fuchsia-400" />
                <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {p.porcentaje}%
                </span>
                <PrioridadBadge prioridad={p.prioridad} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Dashboard() {
  const { datos, cargando, error, recargar } = useFetch<DashboardResumen>('/dashboard');
  // Filtro por tipo de programa -- solo afecta "Avance por programa", para
  // poder enfocarse en un tipo sin perder de vista el resto del dashboard.
  const [filtroTipo, setFiltroTipo] = useState<ProgramType | null>(null);

  const porProgramaFiltrado = datos
    ? (filtroTipo ? datos.porPrograma.filter((p) => p.type === filtroTipo) : datos.porPrograma)
    : [];

  return (
    <Layout ancho="completo">
      <TituloPagina
        titulo="Dashboard"
        subtitulo={datos ? `${datos.programas.total} ${datos.programas.total === 1 ? 'programa activo' : 'programas activos'} · ${datos.asignaturas.total} asignaturas` : undefined}
      >
        <button
          type="button"
          onClick={recargar}
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
        >
          <IconoActualizar className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </TituloPagina>

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {datos && datos.asignaturas.total === 0 && (
        <Vacio mensaje="Todavía no hay asignaturas para mostrar métricas." />
      )}

      {datos && datos.asignaturas.total > 0 && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(260px,1.4fr)_repeat(4,1fr)] gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5 flex items-center gap-5 animar-entrada transition-shadow hover:shadow-md" style={{ animationDelay: '0ms' }}>
              <AnilloAvance porcentaje={datos.avanceGlobal.porcentaje} />
              <div className="min-w-0">
                <p className="text-[12px] text-slate-500 dark:text-slate-400">Avance global</p>
                <p className="mt-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {datos.avanceGlobal.terminados} de {datos.avanceGlobal.total}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">pasos terminados</p>
              </div>
            </div>

            <StatTile etiqueta="Programas activos" valor={datos.programas.total} icon={IconoPrograma} color="blue" retrasoMs={60} />
            <StatTile etiqueta="Asignaturas activas" valor={datos.asignaturas.total} icon={IconoAsignatura} color="violet" retrasoMs={120} />
            <StatTile etiqueta="Docentes asignados" valor={datos.docentes.total} icon={IconoDocente} color="teal" retrasoMs={180} />
            <StatTile etiqueta="Apartados bloqueados" valor={datos.bloqueados} icon={IconoCandado} color="amber" retrasoMs={240} />
          </div>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '280ms' }}>
            <TituloSeccion
              icon={IconoCampana}
              color="rose"
              titulo={<>Alertas {datos.alertas.length > 0 && `(${datos.alertas.length})`}</>}
              subtitulo="Fechas límite (7 días), contratos (15 días) y entregas de libro por vencer o ya vencidos"
            />
            <Alertas alertas={datos.alertas} />
          </section>

          <div className="flex flex-wrap items-center gap-2 animar-entrada" style={{ animationDelay: '320ms' }}>
            {(Object.entries(datos.programas.porTipo) as [ProgramType, number][])
              .filter(([, n]) => n > 0)
              .map(([tipo, n]) => (
                <span
                  key={tipo}
                  className="text-[12px] px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  {ETIQUETA_TIPO[tipo]}: <strong className="text-slate-800 dark:text-slate-100">{n}</strong>
                </span>
              ))}
          </div>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '360ms' }}>
            <TituloSeccion icon={IconoTendencia} color="cyan" titulo="Pasos terminados por semana" subtitulo="Últimas 8 semanas" />
            <GraficoTendencia datos={datos.tendenciaSemanal} />
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '400ms' }}>
            <TituloSeccion icon={IconoPastel} color="indigo" titulo="Avance por estado" />
            <PorEstado porEstado={datos.porEstado} />
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '440ms' }}>
              <TituloSeccion
                icon={IconoCapas}
                color="sky"
                titulo="Avance por apartado"
                subtitulo="De menor a mayor avance, para ver primero lo más atrasado"
              />
              <EjeAvance />
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {datos.porApartado.map((b) => (
                  <FilaAvance
                    key={b.blockKey}
                    etiqueta={b.label}
                    detalle={`${b.terminados} de ${b.total}`}
                    porcentaje={b.porcentaje}
                    color="bg-sky-500 dark:bg-sky-400"
                  />
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '480ms' }}>
              <TituloSeccion icon={IconoPrograma} color="blue" titulo="Avance por programa" subtitulo="De menor a mayor avance" />
              <div className="flex flex-wrap items-center gap-1 mb-3 -mt-1">
                <FiltroPildora activo={filtroTipo === null} onClick={() => setFiltroTipo(null)}>Todos</FiltroPildora>
                {ORDEN_TIPOS.map((t) => (
                  <FiltroPildora key={t} activo={filtroTipo === t} onClick={() => setFiltroTipo(t)}>
                    {ETIQUETA_TIPO[t]}
                  </FiltroPildora>
                ))}
              </div>
              <EjeAvance />
              {porProgramaFiltrado.length === 0 ? (
                <p className="text-[12px] text-slate-400 dark:text-slate-500">Ningún programa de este tipo.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {porProgramaFiltrado.map((p) => (
                    <FilaAvance
                      key={p.id}
                      etiqueta={p.name}
                      detalle={`${ETIQUETA_TIPO[p.type]} · ${p.asignaturas} ${p.asignaturas === 1 ? 'asignatura' : 'asignaturas'}`}
                      porcentaje={p.porcentaje}
                      to={`/programas/${p.id}`}
                      color="bg-blue-500 dark:bg-blue-400"
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <PlanVirtualizacion datos={datos.virtualizacion} />

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animar-entrada" style={{ animationDelay: '800ms' }}>
            <TituloSeccion
              icon={IconoBandera}
              color="rose"
              titulo="Asignaturas más atrasadas"
              subtitulo={`Las ${datos.asignaturasMasAtrasadas.length} con menor avance de toda la app`}
            />
            <EjeAvance />
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {datos.asignaturasMasAtrasadas.map((a) => (
                <FilaAvance
                  key={a.id}
                  etiqueta={a.name}
                  detalle={`${a.programName} · ${a.terminados} de ${a.total}`}
                  porcentaje={a.porcentaje}
                  to={`/asignaturas/${a.id}`}
                  color="bg-rose-500 dark:bg-rose-400"
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
