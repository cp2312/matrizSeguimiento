import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { Layout } from '../components/Layout';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando, Vacio } from '../components/ui/Estado';
import { ESTADOS, ORDEN_ESTADOS, fechaCorta } from '../lib/estados';
import { ETIQUETA_TIPO } from '../lib/tiposPrograma';
import type { AlertaResumen, CellStatus, DashboardResumen, ProgramType } from '@shared/types';

function StatTile({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4">
      <p className="text-[12px] text-slate-500 dark:text-slate-400">{etiqueta}</p>
      <p className="mt-1 text-[26px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{valor}</p>
    </div>
  );
}

/** Barra de magnitud (un solo color, más lleno = más avance) -- mismo patrón
 *  que ya usa el avance de una asignatura en el tablero del programa, con
 *  líneas de grilla en 25/50/75% (recesivas, detrás del relleno) para que
 *  se lea como una escala de verdad y no solo una barra suelta. */
function BarraAvance({ porcentaje, className = '' }: { porcentaje: number; className?: string }) {
  return (
    <div className={`relative rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ${className}`}>
      {[25, 50, 75].map((m) => (
        <div key={m} className="absolute top-0 bottom-0 w-px bg-white/70 dark:bg-black/25" style={{ left: `${m}%` }} />
      ))}
      <div
        className="relative h-full rounded-full bg-marca-500 dark:bg-marca-400 transition-all"
        style={{ width: `${porcentaje}%` }}
      />
    </div>
  );
}

/** Fila de una lista de avance (apartado o programa): etiqueta + barra + %.
 *  Las listas vienen ordenadas de menor a mayor avance, para que lo más
 *  atrasado salte a la vista de una vez, arriba de todo. */
function FilaAvance({
  etiqueta, detalle, porcentaje, to,
}: { etiqueta: React.ReactNode; detalle?: string; porcentaje: number; to?: string }) {
  const contenido = (
    <>
      <div className="w-40 sm:w-52 shrink-0 min-w-0">
        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{etiqueta}</p>
        {detalle && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{detalle}</p>}
      </div>
      <BarraAvance porcentaje={porcentaje} className="flex-1 h-2" />
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

/** Todos los pasos "que aplican" de toda la app, repartidos por estado --
 *  barra apilada horizontal (proporción) + leyenda con el conteo de cada uno.
 *  Mismos colores que ya usa el tablero y la Leyenda (ver lib/estados.ts). */
function PorEstado({ porEstado }: { porEstado: Record<CellStatus, number> }) {
  const total = ORDEN_ESTADOS.reduce((acc, e) => acc + porEstado[e], 0);
  const segmentos = ORDEN_ESTADOS
    .map((estado) => ({ estado, cantidad: porEstado[estado], pct: total ? (porEstado[estado] / total) * 100 : 0 }))
    .filter((s) => s.cantidad > 0);

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
              className="h-full flex items-center justify-center overflow-hidden"
              style={{ width: `${s.pct}%`, background: e.fondo }}
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
  if (datos.length === 0) return null;

  const W = 700;
  const H = 190;
  const M = { top: 18, right: 14, bottom: 26, left: 28 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = datos.length;

  const techo = techoLindo(Math.max(1, ...datos.map((d) => d.terminados)));
  const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => M.top + plotH - (v / techo) * plotH;

  const puntos = datos.map((d, i) => ({ ...d, cx: x(i), cy: y(d.terminados) }));
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const base = M.top + plotH;
  const area = `${linea} L${puntos[n - 1].cx.toFixed(1)},${base} L${puntos[0].cx.toFixed(1)},${base} Z`;

  const ticksY = [0, techo / 2, techo];

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

      <path d={area} className="fill-marca-500 dark:fill-marca-400" opacity={0.1} />
      <path d={linea} fill="none" className="stroke-marca-500 dark:stroke-marca-400" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {puntos.map((p, i) => (
        <g key={p.semana}>
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

export default function Dashboard() {
  const { datos, cargando, error, recargar } = useFetch<DashboardResumen>('/dashboard');

  return (
    <Layout ancho="completo">
      <TituloPagina
        titulo="Dashboard"
        subtitulo={datos ? `${datos.programas.total} ${datos.programas.total === 1 ? 'programa activo' : 'programas activos'} · ${datos.asignaturas.total} asignaturas` : undefined}
      >
        <button
          type="button"
          onClick={recargar}
          className="text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
        >
          ↻ Actualizar
        </button>
      </TituloPagina>

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {datos && datos.asignaturas.total === 0 && (
        <Vacio mensaje="Todavía no hay asignaturas para mostrar métricas." />
      )}

      {datos && datos.asignaturas.total > 0 && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.4fr)_repeat(4,1fr)] gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5">
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Avance global</p>
              <p className="mt-1 text-[44px] leading-none font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                {datos.avanceGlobal.porcentaje}%
              </p>
              <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
                {datos.avanceGlobal.terminados} de {datos.avanceGlobal.total} pasos terminados
              </p>
              <BarraAvance porcentaje={datos.avanceGlobal.porcentaje} className="mt-3 h-2.5" />
            </div>

            <StatTile etiqueta="Programas activos" valor={datos.programas.total} />
            <StatTile etiqueta="Asignaturas activas" valor={datos.asignaturas.total} />
            <StatTile etiqueta="Docentes asignados" valor={datos.docentes.total} />
            <StatTile etiqueta="Apartados bloqueados" valor={datos.bloqueados} />
          </div>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">
              Alertas {datos.alertas.length > 0 && `(${datos.alertas.length})`}
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">
              Fechas límite (7 días), contratos (15 días) y entregas de libro por vencer o ya vencidos
            </p>
            <Alertas alertas={datos.alertas} />
          </section>

          <div className="flex flex-wrap items-center gap-2">
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

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">Pasos terminados por semana</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">Últimas 8 semanas</p>
            <GraficoTendencia datos={datos.tendenciaSemanal} />
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-3">Avance por estado</h2>
            <PorEstado porEstado={datos.porEstado} />
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">Avance por apartado</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">
                De menor a mayor avance, para ver primero lo más atrasado
              </p>
              <EjeAvance />
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {datos.porApartado.map((b) => (
                  <FilaAvance
                    key={b.blockKey}
                    etiqueta={b.label}
                    detalle={`${b.terminados} de ${b.total}`}
                    porcentaje={b.porcentaje}
                  />
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">Avance por programa</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">De menor a mayor avance</p>
              <EjeAvance />
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {datos.porPrograma.map((p) => (
                  <FilaAvance
                    key={p.id}
                    etiqueta={p.name}
                    detalle={`${ETIQUETA_TIPO[p.type]} · ${p.asignaturas} ${p.asignaturas === 1 ? 'asignatura' : 'asignaturas'}`}
                    porcentaje={p.porcentaje}
                    to={`/programas/${p.id}`}
                  />
                ))}
              </div>
            </section>
          </div>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">Asignaturas más atrasadas</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">
              Las {datos.asignaturasMasAtrasadas.length} con menor avance de toda la app
            </p>
            <EjeAvance />
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {datos.asignaturasMasAtrasadas.map((a) => (
                <FilaAvance
                  key={a.id}
                  etiqueta={a.name}
                  detalle={`${a.programName} · ${a.terminados} de ${a.total}`}
                  porcentaje={a.porcentaje}
                  to={`/asignaturas/${a.id}`}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
