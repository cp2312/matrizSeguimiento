import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Boton } from '../components/ui/Boton';
import { Alerta } from '../components/ui/Alerta';
import { Cargando, Vacio } from '../components/ui/Estado';
import { ESTADOS } from '../lib/estados';
import type { CellStatus } from '@shared/types';

interface EntradaActividad {
  id: number;
  changedAt: string;
  subjectId: number;
  programa: string;
  asignatura: string;
  bloque: string;
  paso: string;
  /** clave del apartado para armar el link directo, ej. "ovas.2" */
  apartado: string;
  oldStatus: CellStatus | null;
  newStatus: CellStatus;
  oldComment: string | null;
  newComment: string | null;
  usuario: string | null;
  iniciales: string | null;
}

const TAMANO_PAGINA = 50;

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function Chip({ estado }: { estado: CellStatus | null }) {
  if (!estado) {
    return <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">nuevo</span>;
  }
  const e = ESTADOS[estado];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: e.fondo, color: e.texto, border: e.borde ? '1px solid rgba(0,0,0,.15)' : 'none' }}
    >
      {e.label}
    </span>
  );
}

/**
 * Registro de actividad: cada cambio de estado o comentario, de cualquier
 * asignatura, más reciente primero. El dato ya existía (cell_history se
 * llena solo con cada guardado) -- esto solo lo hace visible para el
 * administrador, sin tener que entrar asignatura por asignatura.
 */
export default function Actividad() {
  const [entradas, setEntradas] = useState<EntradaActividad[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');

  async function pedirPagina(offset: number) {
    return api.get<{ entradas: EntradaActividad[]; total: number }>(
      `/auditoria?limit=${TAMANO_PAGINA}&offset=${offset}`
    );
  }

  useEffect(() => {
    pedirPagina(0)
      .then((res) => { setEntradas(res.entradas); setTotal(res.total); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ocurrió un error'))
      .finally(() => setCargando(false));
  }, []);

  async function cargarMas() {
    if (cargandoMas) return; // evita pedir la misma página dos veces con un doble clic
    setCargandoMas(true);
    setError('');
    try {
      const res = await pedirPagina(entradas.length);
      setEntradas((prev) => [...prev, ...res.entradas]);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <Layout>
      <TituloPagina
        titulo="Actividad"
        subtitulo={cargando ? undefined : `${total} ${total === 1 ? 'cambio registrado' : 'cambios registrados'}`}
      />

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {!cargando && !error && entradas.length === 0 && (
        <Vacio mensaje="Todavía no hay ningún cambio registrado." />
      )}

      {!cargando && entradas.length > 0 && (
        <>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {entradas.map((e) => (
              <Link
                key={e.id}
                to={`/asignaturas/${e.subjectId}?apartado=${encodeURIComponent(e.apartado)}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 grid place-items-center shrink-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {e.iniciales ?? '?'}
                </div>

                <div className="min-w-0 flex-1 basis-[260px]">
                  <p className="text-[13.5px] text-slate-800 dark:text-slate-100 truncate">
                    <strong>{e.usuario ?? 'Alguien'}</strong> marcó <strong>{e.paso}</strong>
                  </p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                    {e.programa} · {e.asignatura} · {e.bloque}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Chip estado={e.oldStatus} />
                  <span className="text-slate-300 dark:text-slate-600 text-[11px]">→</span>
                  <Chip estado={e.newStatus} />
                </div>

                <span className="text-[11.5px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums ml-auto">
                  {formatearFechaHora(e.changedAt)}
                </span>
              </Link>
            ))}
          </div>

          {entradas.length < total && (
            <div className="flex justify-center mt-4">
              <Boton onClick={cargarMas} disabled={cargandoMas}>
                {cargandoMas ? 'Cargando…' : `Cargar más (${total - entradas.length} restantes)`}
              </Boton>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
