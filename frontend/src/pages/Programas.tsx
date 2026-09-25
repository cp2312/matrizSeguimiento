import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useMatriz } from '../hooks/useMatriz';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { Boton } from '../components/ui/Boton';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando, Vacio } from '../components/ui/Estado';
import { Leyenda } from '../components/Leyenda';
import { ModalNuevaAsignatura } from '../components/ModalNuevaAsignatura';
import { ModalApartado } from '../components/ModalApartado';
import { ESTADOS, estadoDelBloque } from '../lib/estados';
import { COLUMNAS_TABLERO, agruparPasos } from '../lib/bloques';
import { normalizar } from '../lib/texto';
import type { CellStatus, Program, Subject, SubjectTeacher } from '@shared/types';

interface FilaTablero extends Subject {
  teachers: SubjectTeacher[];
  estadosPorBloque: Record<string, CellStatus[]>;
  /** claves de bloque que el equipo bloqueó del todo para esta asignatura (ver ModalApartado) */
  bloqueados: string[];
  avance: number;
}

function IconoLupa({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconoCandado({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconoChevron({ direccion }: { direccion: 'izquierda' | 'derecha' }) {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direccion === 'izquierda' ? '15 6 9 12 15 18' : '9 6 15 12 9 18'} />
    </svg>
  );
}

/** Botón de flecha para pasar al programa anterior/siguiente en NavegacionProgramas */
function BotonNavegarPrograma({
  direccion, programa, onClick,
}: {
  direccion: 'izquierda' | 'derecha';
  programa: Program | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!programa}
      title={programa ? programa.name : undefined}
      aria-label={direccion === 'izquierda' ? 'Programa anterior' : 'Programa siguiente'}
      className="w-6 h-6 shrink-0 inline-flex items-center justify-center rounded-full
                 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900
                 text-slate-400 dark:text-slate-500 shadow-sm
                 hover:text-marca-600 dark:hover:text-marca-400 hover:border-marca-300 dark:hover:border-marca-700
                 hover:shadow-md hover:scale-110 active:scale-90
                 disabled:opacity-0 disabled:pointer-events-none disabled:shadow-none disabled:scale-100
                 transition-all duration-150"
    >
      <IconoChevron direccion={direccion} />
    </button>
  );
}

export default function Programa() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<FilaTablero | null>(null);
  const [eliminando, setEliminando] = useState<FilaTablero | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const { datos: programa } = useFetch<Program>(`/programs/${id}`);
  const { datos: filas, cargando, error, recargar } = useFetch<FilaTablero[]>(`/programs/${id}/tablero`);

  // Para las flechas "anterior/siguiente": mismo orden que el listado
  // principal (alfabético, con archivados incluidos para que no se pierda
  // el actual si justo se está viendo uno archivado).
  const { datos: todosLosProgramas } = useFetch<Program[]>('/programs?archivados=true');
  const indiceActual = todosLosProgramas?.findIndex((p) => p.id === Number(id)) ?? -1;
  const programaAnterior = indiceActual > 0 ? todosLosProgramas![indiceActual - 1] : null;
  const programaSiguiente =
    indiceActual !== -1 && indiceActual < (todosLosProgramas?.length ?? 0) - 1
      ? todosLosProgramas![indiceActual + 1]
      : null;

  const filasFiltradas = (filas ?? []).filter((f) => normalizar(f.name).includes(normalizar(busqueda)));

  async function eliminarAsignatura() {
    if (!eliminando) return;
    await api.del(`/subjects/${eliminando.id}`);
    setEliminando(null);
    recargar();
  }

  // Casilla del tablero en la que se hizo clic: carga la matriz de esa asignatura bajo demanda
  const [celdaAbierta, setCeldaAbierta] = useState<{ subjectId: number; blockKey: string; blockLabel: string } | null>(null);
  const {
    datos: datosModal, aplicarCelda: aplicarCeldaModal, aplicarTeachers: aplicarTeachersModal, recargar: recargarModal,
  } = useMatriz(celdaAbierta ? String(celdaAbierta.subjectId) : undefined);
  // evita mostrar un instante los datos de la asignatura anterior mientras carga la nueva
  const datosVigentes = celdaAbierta && datosModal?.asignatura.id === celdaAbierta.subjectId ? datosModal : null;
  const gruposModal = datosVigentes
    ? agruparPasos(datosVigentes.pasos, { videoPorDocente: datosVigentes.asignatura.videos_por_docente })
    : {};

  // Agrupa por semestre para las filas separadoras
  const porSemestre = filasFiltradas.reduce<Record<string, FilaTablero[]>>((acc, f) => {
    (acc[f.semester] ??= []).push(f);
    return acc;
  }, {});

  const total = filas?.length ?? 0;
  const totalFiltrado = filasFiltradas.length;

  return (
    <Layout ancho="completo">
      <TituloPagina
        titulo={
          <span className="inline-flex items-center gap-2">
            <BotonNavegarPrograma
              direccion="izquierda"
              programa={programaAnterior}
              onClick={() => programaAnterior && navigate(`/programas/${programaAnterior.id}`)}
            />
            {programa?.name ?? '…'}
            <BotonNavegarPrograma
              direccion="derecha"
              programa={programaSiguiente}
              onClick={() => programaSiguiente && navigate(`/programas/${programaSiguiente.id}`)}
            />
          </span>
        }
        subtitulo={`${total} ${total === 1 ? 'asignatura' : 'asignaturas'}`}
        volver={
          <Link to="/" className="text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100">
            ← Programas
          </Link>
        }
      >
        <Boton onClick={() => navigate(`/programas/${id}/pendientes`)}>
          Ver pendientes
        </Boton>
        <Boton variante="primario" onClick={() => setCreando(true)}>
          Nueva asignatura
        </Boton>
      </TituloPagina>

      {cargando && <Cargando />}

      {error && <Alerta>{error}</Alerta>}

      {!cargando && !error && total === 0 && (
        <Vacio mensaje="Este programa aún no tiene asignaturas.">
          <Boton variante="primario" onClick={() => setCreando(true)}>
            Crear la primera
          </Boton>
        </Vacio>
      )}

      <Leyenda />

      {!cargando && total > 0 && (
        <>
          <div className="relative mt-4 mb-4 max-w-xs">
            <IconoLupa className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar asignatura…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 text-[13px]
                         outline-none transition-colors focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {totalFiltrado === 0 ? (
            <Vacio mensaje={`Ninguna asignatura coincide con "${busqueda}".`}>
              <Boton onClick={() => setBusqueda('')}>Limpiar búsqueda</Boton>
            </Vacio>
          ) : (
          <div className="space-y-8">
            {Object.entries(porSemestre).map(([semestre, asignaturas]) => (
              <section key={semestre}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                    {semestre}
                  </h2>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {asignaturas.length} {asignaturas.length === 1 ? 'asignatura' : 'asignaturas'}
                  </span>
                </div>

                <div className="space-y-4">
                  {asignaturas.map((a) => (
                    <TarjetaAsignatura
                      key={a.id}
                      asignatura={a}
                      onAbrirBloque={(bloque) =>
                        setCeldaAbierta({ subjectId: a.id, blockKey: bloque.key, blockLabel: bloque.label })
                      }
                      onEditar={() => setEditando(a)}
                      onEliminar={() => setEliminando(a)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          )}
        </>
      )}

      {programa && (
        <ModalNuevaAsignatura
          abierto={creando || !!editando}
          programa={programa}
          asignatura={editando}
          onCerrar={() => { setCreando(false); setEditando(null); }}
          onGuardada={() => { setCreando(false); setEditando(null); recargar(); }}
        />
      )}

      {celdaAbierta && (
        <ModalApartado
          key={`${celdaAbierta.subjectId}-${celdaAbierta.blockKey}`}
          abierto
          subjectId={celdaAbierta.subjectId}
          grupos={gruposModal}
          celdas={datosVigentes?.celdas ?? {}}
          quitadas={datosVigentes?.quitadas}
          teachers={datosVigentes?.asignatura.teachers ?? []}
          apartadoInicial={null}
          bloqueInicial={celdaAbierta.blockKey}
          bloqueLabel={celdaAbierta.blockLabel}
          cargando={!datosVigentes}
          videoPorDocente={datosVigentes?.asignatura.videos_por_docente ?? false}
          onCambiarVideoPorDocente={async (checked) => {
            await api.patch(`/subjects/${celdaAbierta.subjectId}`, { videosPorDocente: checked });
            recargarModal();
          }}
          bookDueDate={datosVigentes?.asignatura.book_due_date ?? null}
          onBookDueDateChanged={() => recargarModal()}
          onGuardado={(celda) => { aplicarCeldaModal(celda); recargar(); }}
          onTeachersChanged={aplicarTeachersModal}
          onCerrar={() => setCeldaAbierta(null)}
          onRecargar={() => { recargarModal(); recargar(); }}
        />
      )}

      {eliminando && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-start justify-center p-4 pt-16 overflow-y-auto"
             onClick={() => setEliminando(null)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6"
               onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-medium text-slate-800 dark:text-slate-100">
              Eliminar asignatura
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              ¿Eliminar <strong className="text-slate-800 dark:text-slate-100">{eliminando.name}</strong>?
              Esta acción quita la asignatura y todo su avance.
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <Boton type="button" onClick={() => setEliminando(null)}>Cancelar</Boton>
              <Boton
                type="button"
                variante="peligro"
                onClick={async () => {
                  await eliminarAsignatura();
                  setEliminando(null);
                }}
              >
                Eliminar
              </Boton>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/** Card de asignatura: encabezado con nombre + avance y la grilla de bloques.
 *  Cada bloque es un chip clicable con el color del estado del apartado. */
function TarjetaAsignatura({
  asignatura,
  onAbrirBloque,
  onEditar,
  onEliminar,
}: {
  asignatura: FilaTablero;
  onAbrirBloque: (bloque: { key: string; label: string }) => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const { id, name, credits, modality, teachers, avance } = asignatura;

  return (
    <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                        rounded-2xl shadow-sm overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-4 bg-slate-50/60 dark:bg-slate-800/40">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/asignaturas/${id}`}
              className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate
                         hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
            >
              {name}
            </Link>
            {modality && (
              <span className={`shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                modality === 'virtual'
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
              }`}>
                {modality === 'virtual' ? 'Virtual' : 'Presencial'}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {credits} {credits === 1 ? 'crédito' : 'créditos'}
            {teachers.length > 0 && ` · ${teachers.map((t) => t.full_name).join(', ')}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onEditar}
            title="Editar asignatura"
            className="w-8 h-8 grid place-items-center rounded-lg text-slate-400
                       hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/70
                       dark:hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onEliminar}
            title="Eliminar asignatura"
            className="w-8 h-8 grid place-items-center rounded-lg text-slate-400
                       hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50
                       dark:hover:bg-red-500/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 text-right w-40 border-l border-slate-200 dark:border-slate-700 pl-4">
          <div className="flex items-baseline justify-end gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Avance</span>
            <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100 leading-none">
              {avance}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-marca-500 dark:bg-marca-400 transition-all"
              style={{ width: `${avance}%` }}
            />
          </div>
        </div>
      </header>

      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {COLUMNAS_TABLERO.map((c) => {
          const bloqueado = asignatura.bloqueados.includes(c.key);

          if (bloqueado) {
            return (
              <button
                key={c.key}
                type="button"
                title={`${c.label}: no aplica a esta asignatura`}
                onClick={() => onAbrirBloque({ key: c.key, label: c.label })}
                className="group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left
                           border border-dashed border-slate-300 dark:border-slate-600
                           bg-slate-50/60 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500
                           transition-colors hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer"
              >
                <IconoCandado className="w-3 h-3 shrink-0" />
                <span className="text-[11.5px] font-medium leading-tight truncate italic">
                  {c.label}
                </span>
              </button>
            );
          }

          const estado = estadoDelBloque(asignatura.estadosPorBloque[c.key] ?? []);
          const e = ESTADOS[estado];
          return (
            <button
              key={c.key}
              type="button"
              title={`${c.label}: ${e.label}`}
              onClick={() => onAbrirBloque({ key: c.key, label: c.label })}
              className="group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left
                         transition-colors hover:ring-2 hover:ring-black/10
                         dark:hover:ring-white/20 cursor-pointer"
              style={{
                background: e.fondo,
                color: e.texto,
                border: e.borde ? '0.5px solid rgba(0,0,0,.12)' : 'none',
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-110"
                style={{ background: e.texto, opacity: 0.75 }}
              />
              <span className="text-[11.5px] font-medium leading-tight truncate">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}