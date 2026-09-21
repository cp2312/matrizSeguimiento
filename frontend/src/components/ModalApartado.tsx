import { useCallback, useRef, useState } from 'react';
import { Modal } from './ui/Modal';
import { BloqueProceso } from './BloqueProceso';
import { PanelCelda } from './PanelCelda';
import { ItemApartado } from './ItemApartado';
import { pasosVisibles, separarGruposVisibles } from '../lib/bloques';
import type { GrupoPasos } from '../lib/bloques';
import type { MatrixCell, SubjectTeacher } from '@shared/types';

interface Props {
  abierto: boolean;
  subjectId: number;
  grupos: Record<string, GrupoPasos>;
  celdas: Record<string, MatrixCell>;
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

/** Tarjeta punteada para agregar una instancia extra de un bloque extensible (p. ej. otro video) */
function TileAgregar({ etiqueta, onClick }: { etiqueta: string; onClick: () => void }) {
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
  abierto, subjectId, grupos, celdas, teachers,
  apartadoInicial, bloqueInicial, bloqueLabel, cargando = false,
  videoPorDocente = false, onCambiarVideoPorDocente,
  bookDueDate = null, onBookDueDateChanged,
  onGuardado, onTeachersChanged, onCerrar, onRecargar,
}: Props) {
  // Un bloque extensible (OVA, Podcast, Video de contenido) puede tener
  // instancias extra ocultas hasta que se agregan a mano -- no se listan acá.
  const { visibles, siguientesExtra } = separarGruposVisibles(grupos, celdas);
  const entradas = Object.entries(visibles);

  const instanciasBloque = bloqueInicial
    ? entradas.filter(([clave]) => clave === bloqueInicial || clave.startsWith(`${bloqueInicial}.`))
    : [];
  const siguienteExtraDelBloque = bloqueInicial
    ? siguientesExtra.find((s) => s.clave === bloqueInicial || s.clave.startsWith(`${bloqueInicial}.`))
    : undefined;

  // El modal se puede montar antes de que terminen de cargar los datos (entrada
  // directa desde el tablero), así que no basta con leer las props una sola vez:
  // mientras no se elija nada a mano, siguen su valor más reciente.
  //
  // Si el bloque tiene más de una opción -- ya sea porque hay varias
  // instancias visibles, o porque hay una extra que se podría agregar --
  // se muestra siempre el selector de tarjetas (vista "instancias"), aunque
  // por ahora solo exista una real. Así "Podcast" (1 credito, siempre
  // arranca en 1) se ve igual que "OVA" con varios creditos, en vez de
  // saltar derecho al detalle solo porque hoy hay una sola tarjeta.
  const hayOpcionesDelBloque = instanciasBloque.length > 1 || !!siguienteExtraDelBloque;
  const apartadoPorDefecto = apartadoInicial ??
    (!hayOpcionesDelBloque && instanciasBloque.length === 1 ? instanciasBloque[0][0] : null);
  const vistaPorDefecto: Vista = !apartadoInicial && hayOpcionesDelBloque ? 'instancias' : 'detalle';

  const [apartadoManual, setApartadoManual] = useState<string | null>(null);
  const [vistaManual, setVistaManual] = useState<Vista | null>(null);
  const apartado = apartadoManual ?? apartadoPorDefecto;
  const vista = vistaManual ?? vistaPorDefecto;

  const [pasoSeleccionado, setPasoSeleccionado] = useState<string | null>(null);

  // Si el formulario del paso tiene cambios sin tocar "Guardar", cerrarlo
  // (Escape, fondo o la X) no los descarta en silencio: se pregunta primero.
  const panelDirty = useRef(false);

  const cerrarModal = useCallback(() => onCerrar(), [onCerrar]);

  // Cerrar desde el formulario del paso: con cambios sin guardar se pregunta y
  // se vuelve a la lista del apartado; limpio (o recién guardado) se cierra el
  // modal completo y queda un solo modal en pantalla.
  const cerrarDesdeForm = useCallback(() => {
    if (panelDirty.current) {
      if (!window.confirm('Hay cambios sin guardar en este paso. ¿Salir sin guardar?')) return;
      panelDirty.current = false;
      setPasoSeleccionado(null);
      return;
    }
    cerrarModal();
  }, [cerrarModal]);

  function elegir(clave: string) {
    setApartadoManual(clave);
    setVistaManual('detalle');
    setPasoSeleccionado(null);
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
        {cargando ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Cargando…</p>
        ) : vista === 'todos' ? (
          <div className="grid sm:grid-cols-2 gap-2 max-h-[65vh] overflow-y-auto pr-1">
            {entradas.map(([clave, g]) => (
              <ItemApartado
                key={clave}
                titulo={g.titulo}
                pasos={g.pasos}
                celdas={celdas}
                activo={clave === apartado}
                onClick={() => elegir(clave)}
              />
            ))}
            {siguientesExtra.map((s) => (
              <TileAgregar key={s.clave} etiqueta={s.etiqueta} onClick={() => elegir(s.clave)} />
            ))}
          </div>
        ) : vista === 'instancias' ? (
          <div className="grid sm:grid-cols-2 gap-2">
            {instanciasBloque.map(([clave, g]) => (
              <ItemApartado
                key={clave}
                titulo={g.titulo}
                pasos={g.pasos}
                celdas={celdas}
                activo={clave === apartado}
                onClick={() => elegir(clave)}
              />
            ))}
            {siguienteExtraDelBloque && (
              <TileAgregar
                etiqueta={siguienteExtraDelBloque.etiqueta}
                onClick={() => elegir(siguienteExtraDelBloque.clave)}
              />
            )}
          </div>
        ) : grupoActivo && pasoActivo ? (
          <PanelCelda
            key={pasoActivo.path}
            subjectId={subjectId}
            paso={pasoActivo}
            celda={celdas[pasoActivo.path]}
            teachers={teachers}
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
    </>
  );
}
