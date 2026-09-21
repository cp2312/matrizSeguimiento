import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { Layout } from '../components/Layout';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando, Vacio } from '../components/ui/Estado';
import { ESTADOS } from '../lib/estados';
import { etiquetaPaso } from '../lib/bloques';
import type { PendienteItem, PendientesAsignatura, PendientesPrograma } from '@shared/types';

/** Tarjeta chica de un paso sin terminar -- lleva directo al apartado de esa
 *  asignatura (mismo criterio de link que usan los avisos por correo). */
function ItemPendiente({ subjectId, item }: { subjectId: number; item: PendienteItem }) {
  const estado = item.celda?.status ?? 'vacio';
  const e = ESTADOS[estado];
  const etiquetaEstado = item.step.customStates?.find((s) => s.value === estado)?.label ?? e.label;
  const apartado = item.path.split('.').slice(0, -1).join('.');

  return (
    <Link
      to={`/asignaturas/${subjectId}?apartado=${encodeURIComponent(apartado)}`}
      className="min-w-[110px] shrink-0 px-2.5 py-2 rounded-lg text-left transition hover:shadow-md hover:brightness-95"
      style={{
        background: e.fondo,
        border: e.borde ? '0.5px solid rgba(0,0,0,.12)' : '0.5px solid transparent',
      }}
    >
      <span className="block text-[11px] font-medium leading-tight" style={{ color: e.texto }}>
        {etiquetaPaso(item.step, item.instance)}
      </span>
      <span className="block text-[10px] mt-0.5" style={{ color: e.textoSuave }}>
        {etiquetaEstado}
      </span>
    </Link>
  );
}

function IconoChevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${abierto ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/** Tarjeta de una asignatura con pendientes: cerrada muestra solo el nombre
 *  y el avance; al presionarla se despliegan los pasos, agrupados por
 *  apartado (mismo criterio que usa la vista de la asignatura). */
function TarjetaPendientes({ asignatura }: { asignatura: PendientesAsignatura }) {
  const { subject, avance, pendientes } = asignatura;
  const [abierto, setAbierto] = useState(false);

  const grupos = pendientes.reduce<Record<string, { titulo: string; items: PendienteItem[] }>>((acc, p) => {
    const instanciaDeBloque = p.instance && !p.step.repeatable ? p.instance : null;
    const clave = instanciaDeBloque ? `${p.blockKey}.${instanciaDeBloque}` : p.blockKey;
    (acc[clave] ??= { titulo: p.blockLabel, items: [] }).items.push(p);
    return acc;
  }, {});

  return (
    <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 bg-slate-50/60 dark:bg-slate-800/40 text-left
                   hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
      >
        <IconoChevron abierto={abierto} />
        <span className="flex-1 min-w-0 text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">
          {subject.name}
        </span>
        <span className="text-[12px] text-slate-400 dark:text-slate-500 shrink-0">
          {pendientes.length} sin terminar
        </span>
        <span className="text-[13px] font-bold tabular-nums text-slate-700 dark:text-slate-200 shrink-0 w-10 text-right">
          {avance.porcentaje}%
        </span>
      </button>

      {abierto && (
        <div className="px-5 py-4 space-y-3">
          <Link
            to={`/asignaturas/${subject.id}`}
            className="inline-block text-[12px] text-marca-600 dark:text-marca-400 hover:underline mb-1"
          >
            Abrir asignatura →
          </Link>
          {Object.entries(grupos).map(([clave, g]) => (
            <div key={clave}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                {g.titulo}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((p) => (
                  <ItemPendiente key={p.path} subjectId={subject.id} item={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function Pendientes() {
  const { id } = useParams();
  const { datos, cargando, error } = useFetch<PendientesPrograma>(`/programs/${id}/pendientes`);

  const conPendientes = datos?.asignaturas.filter((a) => a.pendientes.length > 0) ?? [];
  const completas = datos?.asignaturas.filter((a) => a.pendientes.length === 0) ?? [];
  const totalPendientes = conPendientes.reduce((acc, a) => acc + a.pendientes.length, 0);

  return (
    <Layout ancho="completo">
      <TituloPagina
        titulo={`Pendientes — ${datos?.programa.name ?? '…'}`}
        subtitulo={
          datos
            ? `${totalPendientes} ${totalPendientes === 1 ? 'paso' : 'pasos'} sin terminar en ${conPendientes.length} de ${datos.asignaturas.length} asignaturas`
            : undefined
        }
        volver={
          <Link
            to={`/programas/${id}`}
            className="text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
          >
            ← Volver al programa
          </Link>
        }
      />

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {datos && datos.asignaturas.length === 0 && (
        <Vacio mensaje="Este programa aún no tiene asignaturas." />
      )}

      {datos && datos.asignaturas.length > 0 && conPendientes.length === 0 && (
        <Vacio mensaje="🎉 Todas las asignaturas de este programa están 100% completas." />
      )}

      {conPendientes.length > 0 && (
        <div className="space-y-4">
          {conPendientes.map((a) => (
            <TarjetaPendientes key={a.subject.id} asignatura={a} />
          ))}
        </div>
      )}

      {completas.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">
            ✅ Completas ({completas.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {completas.map((a) => (
              <Link
                key={a.subject.id}
                to={`/asignaturas/${a.subject.id}`}
                className="text-[12px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10
                           text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
              >
                {a.subject.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
