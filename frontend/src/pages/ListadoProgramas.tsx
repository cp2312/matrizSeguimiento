import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { Boton } from '../components/ui/Boton';
import { Campo } from '../components/ui/Campo';
import { AreaTexto } from '../components/ui/AreaTexto';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando, Vacio } from '../components/ui/Estado';
import { TIPOS_PROGRAMA, ORDEN_TIPOS, ETIQUETA_TIPO } from '../lib/tiposPrograma';
import type { Program, ProgramType } from '@shared/types';

type Filtro = 'todos' | ProgramType;

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Swatch + etiqueta del tipo de programa. Híbrido se pinta partido a la
 *  mitad (presencial / virtual) porque no tiene un color propio: es ambos. */
function TipoSwatch({ tipo }: { tipo: ProgramType }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      {tipo === 'hibrido' ? (
        <span className="w-3.5 h-3.5 rounded-sm overflow-hidden flex shrink-0 ring-1 ring-black/5">
          <span className="w-1/2 h-full" style={{ background: TIPOS_PROGRAMA.presencial.color }} />
          <span className="w-1/2 h-full" style={{ background: TIPOS_PROGRAMA.virtual.color }} />
        </span>
      ) : (
        <span
          className="w-3.5 h-3.5 rounded-sm shrink-0 ring-1 ring-black/5"
          style={{ background: TIPOS_PROGRAMA[tipo].color }}
        />
      )}
      {ETIQUETA_TIPO[tipo]}
    </span>
  );
}

function IconoLapiz() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function IconoBasura() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/** Chevron que aparece junto al nombre para marcar que la fila lleva a la matriz */
function IconoFlecha() {
  return (
    <svg
      className="w-3.5 h-3.5 text-slate-300 group-hover:text-marca-500 group-hover:translate-x-0.5 transition-all"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export default function ListadoProgramas() {
  const { datos: programas, cargando, error, recargar } = useFetch<Program[]>('/programs');
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Program | null>(null);
  const [eliminando, setEliminando] = useState<Program | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const navigate = useNavigate();
  const activos = programas?.filter((p) => !p.archived).length ?? 0;
  const visibles = (programas ?? []).filter((p) => filtro === 'todos' || p.type === filtro);

  return (
    <Layout>
      <TituloPagina
        titulo="Programas"
        subtitulo={`${activos} ${activos === 1 ? 'programa' : 'programas'}`}
      >
        <Boton variante="primario" onClick={() => setCreando(true)}>
          Nuevo programa
        </Boton>
      </TituloPagina>

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {!cargando && !error && programas && programas.length === 0 && (
        <Vacio mensaje="Todavía no hay programas.">
          <Boton variante="primario" onClick={() => setCreando(true)}>
            Crear el primero
          </Boton>
        </Vacio>
      )}

      {!cargando && programas && programas.length > 0 && (
        <>
          <div className="flex items-center gap-1 mb-4">
            <FiltroPildora activo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
              Todos
            </FiltroPildora>
            {ORDEN_TIPOS.map((t) => (
              <FiltroPildora key={t} activo={filtro === t} onClick={() => setFiltro(t)}>
                <TipoSwatch tipo={t} />
              </FiltroPildora>
            ))}
          </div>

          {visibles.length === 0 ? (
            <Vacio mensaje="Ningún programa coincide con este filtro." />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left font-medium text-[11px] uppercase tracking-wide text-slate-400 px-4 py-3">
                      Nombre
                    </th>
                    <th className="w-32 text-left font-medium text-[11px] uppercase tracking-wide text-slate-400 px-2 py-3">
                      Tipo
                    </th>
                    <th className="w-36 text-left font-medium text-[11px] uppercase tracking-wide text-slate-400 px-2 py-3">
                      Creado
                    </th>
                    <th className="w-40" />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/programas/${p.id}`)}
                      title="Ver matriz del programa"
                      className={`border-t border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${p.archived ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/programas/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="group inline-flex items-center gap-1 text-slate-800 font-medium hover:text-marca-600 transition-colors"
                        >
                          {p.name}
                          <IconoFlecha />
                        </Link>
                        {p.notes && (
                          <p className="text-[12.5px] text-slate-400 mt-0.5 line-clamp-1">{p.notes}</p>
                        )}
                      </td>
                      <td className="px-2 text-[13px]">
                        <TipoSwatch tipo={p.type} />
                        {p.archived && (
                          <span className="block text-[11px] text-slate-400 mt-1">Archivado</span>
                        )}
                      </td>
                      <td className="px-2 text-slate-500 text-[13px] tabular-nums whitespace-nowrap">
                        {formatearFecha(p.created_at)}
                      </td>
                      <td className="text-right pr-4 whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditando(p); }}
                          className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <IconoLapiz />
                          Editar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEliminando(p); }}
                          className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-red-600 transition-colors ml-3"
                        >
                          <IconoBasura />
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ModalPrograma
        abierto={creando}
        onCerrar={() => setCreando(false)}
        onGuardado={() => { setCreando(false); recargar(); }}
      />

      <ModalPrograma
        abierto={!!editando}
        programa={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={() => { setEditando(null); recargar(); }}
      />

      <ModalEliminarPrograma
        programa={eliminando}
        onCerrar={() => setEliminando(null)}
        onEliminado={() => { setEliminando(null); recargar(); }}
      />
    </Layout>
  );
}

function FiltroPildora({
  activo, onClick, children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 inline-flex items-center rounded-lg text-[13px] font-medium transition-colors ${
        activo ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

const TIPOS_SELECT = ORDEN_TIPOS.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO[t] }));

function ModalPrograma({
  abierto, programa, onCerrar, onGuardado,
}: {
  abierto: boolean;
  programa?: Program | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = !!programa;

  const [form, setForm] = useState<{ name: string; notes: string; type: ProgramType }>({
    name: '', notes: '', type: 'presencial',
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Precarga los datos al abrir en modo edición
  const [idCargado, setIdCargado] = useState<number | null>(null);
  if (abierto && programa && idCargado !== programa.id) {
    setIdCargado(programa.id);
    setForm({
      name: programa.name,
      notes: programa.notes ?? '',
      type: programa.type,
    });
  }
  if (abierto && !programa && idCargado !== null) {
    setIdCargado(null);
    setForm({ name: '', notes: '', type: 'presencial' });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      if (esEdicion) {
        await api.patch(`/programs/${programa!.id}`, form);
      } else {
        await api.post('/programs', form);
        setForm({ name: '', notes: '', type: 'presencial' });
      }
      onGuardado();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo={esEdicion ? 'Editar programa' : 'Nuevo programa'} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo
          etiqueta="Nombre"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <AreaTexto
          etiqueta="Notas (opcional)"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <Select
          etiqueta="Tipo"
          opciones={TIPOS_SELECT}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as ProgramType })}
        />

        <Alerta>{error}</Alerta>

        <div className="flex gap-2 justify-end pt-1">
          <Boton type="button" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario" disabled={enviando}>
            {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear programa'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

function ModalEliminarPrograma({
  programa, onCerrar, onEliminado,
}: {
  programa: Program | null;
  onCerrar: () => void;
  onEliminado: () => void;
}) {
  const [error, setError] = useState('');
  const [eliminando, setEliminando] = useState(false);

  async function confirmar() {
    setError('');
    setEliminando(true);
    try {
      await api.del(`/programs/${programa!.id}`);
      onEliminado();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Modal abierto={!!programa} titulo="Eliminar programa" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          ¿Seguro que querés eliminar <strong>{programa?.name}</strong>? Esto borra también todas
          sus asignaturas, celdas e historial. La acción no se puede deshacer.
        </p>

        <Alerta>{error}</Alerta>

        <div className="flex gap-2 justify-end pt-1">
          <Boton type="button" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="button" variante="peligro" onClick={confirmar} disabled={eliminando}>
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
