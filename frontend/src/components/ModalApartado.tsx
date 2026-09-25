import { useCallback, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Boton } from './ui/Boton';
import { ModalConfirmar } from './ui/ModalConfirmar';
import { Alerta } from './ui/Alerta';
import { BloqueProceso } from './BloqueProceso';
import { PanelCelda } from './PanelCelda';
import { ItemApartado } from './ItemApartado';
import { pasosVisibles, separarGruposVisibles } from '../lib/bloques';
import type { GrupoPasos, InstanciaParaAgregar } from '../lib/bloques';
import type { MatrixCell, SubjectTeacher } from '@shared/types';

interface Props {
  abierto: boolean;
  subjectId: number;
  grupos: Record<string, GrupoPasos>;
  celdas: Record<string, MatrixCell>;
  /** claves "bloque.instancia" de instancias garantizadas quitadas a mano (ver useMatriz) */
  quitadas?: ReadonlySet<string>;
  teachers: SubjectTeacher[];
  /** apartado con el que abre la ventana (p. ej. una tarjeta ya elegida en la lista de la asignatura) */
  apartadoInicial: string | null;
  /**
   * Bloque crudo con el que abre (p. ej. la casilla "OVA" del tablero, que junta todas las
   * instancias). Si tiene más de una instancia (OVA 1, OVA 2…), muestra primero solo esas en
   * vez de aterrizar en la primera al azar — con créditos, todas son igual de relevantes.
   */
  bloqueInicial?: string | null;
  bloqueLabel?: string;
  /** los datos de la asignatura todavía se están cargando (entrada directa desde el tablero) */
  cargando?: boolean;
  /** los videos de esta asignatura los graba el profesor (renombra el bloque a "Video tutorial") */
  videoPorDocente?: boolean;
  onCambiarVideoPorDocente?: (checked: boolean) => void;
  /** fecha tentativa de entrega del libro (una sola por asignatura, no por docente) */
  bookDueDate?: string | null;
  onBookDueDateChanged?: (bookDueDate: string | null) => void;
  onGuardado: (celda: MatrixCell) => void;
  onTeachersChanged: (teachers: SubjectTeacher[]) => void;
  onCerrar: () => void;
  onRecargar?: () => void;
}

// Solo "Video de contenido" ofrece el checkbox de "lo graba el profesor" --
// "Video de bienvenida" mantiene siempre su nombre y su checklist normal.
const BLOQUES_VIDEO = new Set(['video_contenido']);

type Vista = 'detalle' | 'instancias' | 'todos';

function IconoCandado({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Tarjeta punteada para agregar una instancia extra de un bloque extensible (p. ej. otro video),
 *  o -- si `bloqueado` -- para un apartado completo bloqueado (ver 'desbloquear-bloque') */
function TileAgregar({ etiqueta, bloqueado, onClick }: { etiqueta: string; bloqueado?: boolean; onClick: () => void }) {
  if (bloqueado) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${etiqueta}: no aplica a esta asignatura -- clic para desbloquear`}
        className="flex items-center gap-2 px-3.5 h-11 rounded-lg border border-dashed border-slate-300 dark:border-slate-600
                   bg-slate-50/60 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 text-[13px] text-left italic
                   transition-colors hover:border-slate-400 dark:hover:border-slate-500"
      >
        <IconoCandado className="w-3 h-3 shrink-0" />
        {etiqueta} — bloqueado
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3.5 h-11 rounded-lg border border-dashed border-slate-300 dark:border-slate-700
                 text-slate-400 dark:text-slate-500 text-[13px] text-left transition-colors
                 hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-white/5 hover:bg-slate-50"
    >
      + Agregar {etiqueta}
    </button>
  );
}

/**
 * Ventana flotante de un apartado. Un botón "Ver todos" cambia, dentro de la
 * misma ventana, a una lista con todos los apartados para poder saltar a
 * otro sin cerrarla.
 */
export function ModalApartado({
  abierto, subjectId, grupos, celdas, quitadas, teachers,
  apartadoInicial, bloqueInicial, bloqueLabel, cargando = false,
  videoPorDocente = false, onCambiarVideoPorDocente,
  bookDueDate = null, onBookDueDateChanged,
  onGuardado, onTeachersChanged, onCerrar, onRecargar,
}: Props) {
  // Un bloque repetible puede tener instancias extra ocultas hasta que se
  // agregan a mano, o instancias garantizadas quitadas a mano -- no se
  // listan acá (ver paraAgregar).
  const { visibles, paraAgregar } = separarGruposVisibles(grupos, celdas, quitadas);
  const entradas = Object.entries(visibles);

  const instanciasBloque = bloqueInicial
    ? entradas.filter(([clave]) => clave === bloqueInicial || clave.startsWith(`${bloqueInicial}.`))
    : [];
  const paraAgregarDelBloque = bloqueInicial
    ? paraAgregar.filter((s) => s.clave === bloqueInicial || s.clave.startsWith(`${bloqueInicial}.`))
    : [];

  // Para el botón "Bloquear apartado completo": cuántas instancias
  // GARANTIZADAS por créditos tiene este bloque en total (de `grupos`, sin
  // filtrar -- siguen existiendo aunque estén quitadas) y cuántas de esas ya
  // están quitadas. Si son todas, el apartado entero "no aplica" y se
  // reemplaza el selector por un aviso con botón de desbloquear.
  const gruposDelBloque = bloqueInicial
    ? Object.entries(grupos).filter(([clave]) => clave === bloqueInicial || clave.startsWith(`${bloqueInicial}.`))
    : [];
  const instanciasGarantizadasDelBloque = gruposDelBloque.filter(([, g]) => {
    const p0 = g.pasos[0];
    return p0 && p0.instance !== null && p0.garantizada;
  });
  const totalGarantizadasDelBloque = instanciasGarantizadasDelBloque.length;
  const quitadasDelBloqueCount = quitadas
    ? instanciasGarantizadasDelBloque.filter(([, g]) => {
        const p0 = g.pasos[0];
        return quitadas.has(`${p0.blockKey}.${p0.instance}`);
      }).length
    : 0;
  const bloqueCompletamenteQuitado = totalGarantizadasDelBloque > 0 && quitadasDelBloqueCount === totalGarantizadasDelBloque;

  // El modal se puede montar antes de que terminen de cargar los datos (entrada
  // directa desde el tablero), así que no basta con leer las props una sola vez:
  // mientras no se elija nada a mano, siguen su valor más reciente.
  //
  // Si el bloque tiene más de una opción -- ya sea porque hay varias
  // instancias visibles, o porque hay una extra que se podría agregar, o una
  // quitada que se podría restaurar -- se muestra siempre el selector de
  // tarjetas (vista "instancias"), aunque por ahora solo exista una real. Así
  // "Podcast" (1 credito, siempre arranca en 1) se ve igual que "OVA" con
  // varios creditos, en vez de saltar derecho al detalle solo porque hoy hay
  // una sola tarjeta.
  const hayOpcionesDelBloque = instanciasBloque.length > 1 || paraAgregarDelBloque.length > 0;
  const apartadoPorDefecto = apartadoInicial ??
    (!hayOpcionesDelBloque && instanciasBloque.length === 1 ? instanciasBloque[0][0] : null);
  const vistaPorDefecto: Vista = !apartadoInicial && hayOpcionesDelBloque ? 'instancias' : 'detalle';

  const [apartadoManual, setApartadoManual] = useState<string | null>(null);
  const [vistaManual, setVistaManual] = useState<Vista | null>(null);
  const apartado = apartadoManual ?? apartadoPorDefecto;
  const vista = vistaManual ?? vistaPorDefecto;

  const [pasoSeleccionado, setPasoSeleccionado] = useState<string | null>(null);

  // Si el formulario del paso tiene cambios sin tocar "Guardar", cerrarlo
  // (Escape, fondo o la X) no los descarta en silencio: se pregunta primero,
  // con el modal de confirmación propio de la app (no el nativo del navegador).
  const panelDirty = useRef(false);
  const [confirmandoSalir, setConfirmandoSalir] = useState(false);

  const cerrarModal = useCallback(() => onCerrar(), [onCerrar]);

  // Cerrar desde el formulario del paso: con cambios sin guardar se pregunta y
  // se vuelve a la lista del apartado; limpio (o recién guardado) se cierra el
  // modal completo y queda un solo modal en pantalla.
  const cerrarDesdeForm = useCallback(() => {
    if (panelDirty.current) {
      setConfirmandoSalir(true);
      return;
    }
    cerrarModal();
  }, [cerrarModal]);

  function confirmarSalirSinGuardar() {
    panelDirty.current = false;
    setConfirmandoSalir(false);
    setPasoSeleccionado(null);
  }

  function elegir(clave: string) {
    setApartadoManual(clave);
    setVistaManual('detalle');
    setPasoSeleccionado(null);
  }

  // "Quitar" y "Bloquear" pierden avance guardado, así que siguen pidiendo
  // confirmación -- con el modal propio de la app en vez del nativo del
  // navegador. Restaurar/desbloquear no son destructivos: no la piden, solo
  // muestran el error acá si algo falla.
  const [quitando, setQuitando] = useState<{ blockKey: string; instance: number; etiqueta: string } | null>(null);
  const [enviandoQuitar, setEnviandoQuitar] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState('');
  const [confirmandoBloquear, setConfirmandoBloquear] = useState<string | null>(null);
  const [enviandoBloquear, setEnviandoBloquear] = useState(false);
  const [errorBloquear, setErrorBloquear] = useState('');
  const [errorAccion, setErrorAccion] = useState('');

  async function confirmarQuitar() {
    if (!quitando) return;
    setEnviandoQuitar(true);
    setErrorQuitar('');
    try {
      await api.del(`/subjects/${subjectId}/instances/${quitando.blockKey}/${quitando.instance}`);
      onRecargar?.();
      setQuitando(null);
    } catch (err) {
      setErrorQuitar(err instanceof Error ? err.message : 'No se pudo quitar');
    } finally {
      setEnviandoQuitar(false);
    }
  }

  async function restaurarInstancia(blockKey: string, instance: number) {
    setErrorAccion('');
    try {
      await api.post(`/subjects/${subjectId}/instances/${blockKey}/${instance}/restaurar`, {});
      onRecargar?.();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : 'No se pudo restaurar');
    }
  }

  function elegirParaAgregar(item: InstanciaParaAgregar) {
    if (item.accion === 'desbloquear-bloque') { desbloquearApartado(item.blockKey); return; }
    if (item.accion === 'restaurar') restaurarInstancia(item.blockKey, item.instance);
    elegir(item.clave);
  }

  async function confirmarBloquear() {
    if (!confirmandoBloquear) return;
    setEnviandoBloquear(true);
    setErrorBloquear('');
    try {
      await api.post(`/subjects/${subjectId}/blocks/${confirmandoBloquear}/bloquear`, {});
      onRecargar?.();
      setConfirmandoBloquear(null);
    } catch (err) {
      setErrorBloquear(err instanceof Error ? err.message : 'No se pudo bloquear');
    } finally {
      setEnviandoBloquear(false);
    }
  }

  async function desbloquearApartado(blockKey: string) {
    setErrorAccion('');
    try {
      await api.post(`/subjects/${subjectId}/blocks/${blockKey}/desbloquear`, {});
      onRecargar?.();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : 'No se pudo desbloquear');
    }
  }

  const grupoActivo = apartado ? grupos[apartado] : null;
  const visiblesActivo = grupoActivo ? pasosVisibles(grupoActivo.pasos, celdas) : [];
  const terminadosActivo = visiblesActivo.filter((p) => celdas[p.path]?.status === 'terminado').length;
  // OJO: busca en grupoActivo.pasos (todos), no en visiblesActivo (filtrados) --
  // "Agregar otro reporte" selecciona un intento que todavía no tiene celda
  // guardada, así que pasosVisibles aún no lo deja ver como chip.
  const pasoActivo = pasoSeleccionado
    ? grupoActivo?.pasos.find((p) => p.path === pasoSeleccionado) ?? null
    : null;

  const titulo = cargando
    ? 'Cargando…'
    : vista === 'todos' ? 'Todos los apartados'
    : vista === 'instancias' ? (bloqueLabel ?? 'Instancias')
    : grupoActivo?.titulo ?? '';

  return (
    <>
      <Modal
        abierto={abierto}
        titulo={titulo}
        subtitulo={!cargando && vista === 'detalle' ? `${terminadosActivo} de ${visiblesActivo.length} pasos` : undefined}
        ancho="grande"
        onCerrar={pasoActivo ? cerrarDesdeForm : cerrarModal}
        accionesTitulo={!cargando ? (
          <button
            onClick={() => {
              setPasoSeleccionado(null);
              setVistaManual(vista === 'todos' ? null : 'todos');
            }}
            className="text-[12px] font-medium text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 flex items-center gap-1 shrink-0 mt-0.5"
          >
            {vista === 'todos' ? '← Volver' : '▦ Ver todos'}
          </button>
        ) : null}
      >
        <Alerta>{errorAccion}</Alerta>
        {cargando ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Cargando…</p>
        ) : vista === 'todos' ? (
          <div className="grid sm:grid-cols-2 gap-2 max-h-[65vh] overflow-y-auto pr-1">
            {entradas.map(([clave, g]) => {
              const p0 = g.pasos[0];
              const esInstancia = p0 && p0.instance !== null;
              return (
                <ItemApartado
                  key={clave}
                  titulo={g.titulo}
                  pasos={g.pasos}
                  celdas={celdas}
                  activo={clave === apartado}
                  onClick={() => elegir(clave)}
                  onEliminar={esInstancia ? () => setQuitando({ blockKey: p0.blockKey, instance: p0.instance!, etiqueta: g.titulo }) : undefined}
                />
              );
            })}
            {paraAgregar.map((s) => (
              <TileAgregar
                key={s.clave}
                etiqueta={s.etiqueta}
                bloqueado={s.accion === 'desbloquear-bloque'}
                onClick={() => elegirParaAgregar(s)}
              />
            ))}
          </div>
        ) : vista === 'instancias' ? (
          bloqueCompletamenteQuitado ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center">
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-3">
                Este apartado no aplica a esta asignatura.
              </p>
              <Boton onClick={() => desbloquearApartado(bloqueInicial!)}>Desbloquear</Boton>
            </div>
          ) : (
            <div>
              <div className="grid sm:grid-cols-2 gap-2">
                {instanciasBloque.map(([clave, g]) => {
                  const p0 = g.pasos[0];
                  const esInstancia = p0 && p0.instance !== null;
                  return (
                    <ItemApartado
                      key={clave}
                      titulo={g.titulo}
                      pasos={g.pasos}
                      celdas={celdas}
                      activo={clave === apartado}
                      onClick={() => elegir(clave)}
                      onEliminar={esInstancia ? () => setQuitando({ blockKey: p0.blockKey, instance: p0.instance!, etiqueta: g.titulo }) : undefined}
                    />
                  );
                })}
                {paraAgregarDelBloque.map((s) => (
                  <TileAgregar key={s.clave} etiqueta={s.etiqueta} onClick={() => elegirParaAgregar(s)} />
                ))}
              </div>
              {totalGarantizadasDelBloque > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmandoBloquear(bloqueInicial!)}
                  className="mt-3 text-[11.5px] text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400
                             underline underline-offset-2"
                >
                  Bloquear este apartado completo (no aplica a esta asignatura)
                </button>
              )}
            </div>
          )
        ) : grupoActivo && pasoActivo ? (
          <PanelCelda
            key={pasoActivo.path}
            subjectId={subjectId}
            paso={pasoActivo}
            celda={celdas[pasoActivo.path]}
            teachers={teachers}
            videoPorDocente={videoPorDocente}
            bookDueDate={bookDueDate}
            onGuardado={onGuardado}
            onTeachersChanged={onTeachersChanged}
            onBookDueDateChanged={(fecha) => onBookDueDateChanged?.(fecha)}
            onCerrar={cerrarDesdeForm}
            onRecargar={onRecargar}
            onDirtyChange={(dirty) => { panelDirty.current = dirty; }}
          />
        ) : grupoActivo && (
          <div className="min-w-0">
            {BLOQUES_VIDEO.has(grupoActivo.pasos[0]?.blockKey) && onCambiarVideoPorDocente && (
              <label className="flex items-center gap-2 mb-3 text-[12px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoPorDocente}
                  onChange={(e) => onCambiarVideoPorDocente(e.target.checked)}
                  className="w-3.5 h-3.5 accent-slate-800"
                />
                Lo graba el profesor (se muestra como "Video tutorial")
              </label>
            )}

            <BloqueProceso
              titulo={grupoActivo.titulo}
              pasos={grupoActivo.pasos}
              celdas={celdas}
              seleccionado={pasoSeleccionado}
              onSeleccionar={setPasoSeleccionado}
              soloContenido
            />
          </div>
        )}
      </Modal>

      <ModalConfirmar
        abierto={confirmandoSalir}
        titulo="Salir sin guardar"
        mensaje="Hay cambios sin guardar en este paso. ¿Salir sin guardar?"
        textoConfirmar="Sí, salir"
        variante="peligro"
        onCancelar={() => setConfirmandoSalir(false)}
        onConfirmar={confirmarSalirSinGuardar}
      />

      <ModalConfirmar
        abierto={!!quitando}
        titulo="Quitar instancia"
        mensaje={<>¿Quitar <strong>{quitando?.etiqueta}</strong>? Se pierde todo su avance guardado.</>}
        textoConfirmar="Sí, quitar"
        variante="peligro"
        enviando={enviandoQuitar}
        error={errorQuitar}
        onCancelar={() => setQuitando(null)}
        onConfirmar={confirmarQuitar}
      />

      <ModalConfirmar
        abierto={!!confirmandoBloquear}
        titulo="Bloquear apartado"
        mensaje="¿Bloquear este apartado completo para esta asignatura? Se pierde todo su avance guardado."
        textoConfirmar="Sí, bloquear"
        variante="peligro"
        enviando={enviandoBloquear}
        error={errorBloquear}
        onCancelar={() => setConfirmandoBloquear(null)}
        onConfirmar={confirmarBloquear}
      />
    </>
  );
}
