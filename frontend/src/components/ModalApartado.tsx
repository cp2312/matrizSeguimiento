import { useState } from 'react';
import { Modal } from './ui/Modal';
import { BloqueProceso } from './BloqueProceso';
import { PanelCelda } from './PanelCelda';
import { ItemApartado } from './ItemApartado';
import { pasosVisibles } from '../lib/bloques';
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
  onGuardado: (celda: MatrixCell) => void;
  onCerrar: () => void;
}

type Vista = 'detalle' | 'instancias' | 'todos';

/**
 * Ventana flotante de un apartado. Un botón "Ver todos" cambia, dentro de la
 * misma ventana, a una lista con todos los apartados para poder saltar a
 * otro sin cerrarla.
 */
export function ModalApartado({
  abierto, subjectId, grupos, celdas, teachers,
  apartadoInicial, bloqueInicial, bloqueLabel, cargando = false, onGuardado, onCerrar,
}: Props) {
  const entradas = Object.entries(grupos);

  const instanciasBloque = bloqueInicial
    ? entradas.filter(([clave]) => clave === bloqueInicial || clave.startsWith(`${bloqueInicial}.`))
    : [];

  // El modal se puede montar antes de que terminen de cargar los datos (entrada
  // directa desde el tablero), así que no basta con leer las props una sola vez:
  // mientras no se elija nada a mano, siguen su valor más reciente.
  const apartadoPorDefecto = apartadoInicial ?? (instanciasBloque.length === 1 ? instanciasBloque[0][0] : null);
  const vistaPorDefecto: Vista = !apartadoInicial && instanciasBloque.length > 1 ? 'instancias' : 'detalle';

  const [apartadoManual, setApartadoManual] = useState<string | null>(null);
  const [vistaManual, setVistaManual] = useState<Vista | null>(null);
  const apartado = apartadoManual ?? apartadoPorDefecto;
  const vista = vistaManual ?? vistaPorDefecto;

  const [pasoSeleccionado, setPasoSeleccionado] = useState<string | null>(null);

  function elegir(clave: string) {
    setApartadoManual(clave);
    setVistaManual('detalle');
    setPasoSeleccionado(null);
  }

  const grupoActivo = apartado ? grupos[apartado] : null;
  const visiblesActivo = grupoActivo ? pasosVisibles(grupoActivo.pasos, celdas) : [];
  const terminadosActivo = visiblesActivo.filter((p) => celdas[p.path]?.status === 'terminado').length;
  const pasoActivo = pasoSeleccionado
    ? visiblesActivo.find((p) => p.path === pasoSeleccionado) ?? null
    : null;

  const titulo = cargando
    ? 'Cargando…'
    : vista === 'todos' ? 'Todos los apartados'
    : vista === 'instancias' ? (bloqueLabel ?? 'Instancias')
    : grupoActivo?.titulo ?? '';

  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      subtitulo={!cargando && vista === 'detalle' ? `${terminadosActivo} de ${visiblesActivo.length} pasos` : undefined}
      ancho="grande"
      onCerrar={onCerrar}
      accionesTitulo={!cargando ? (
        <button
          onClick={() => setVistaManual(vista === 'todos' ? null : 'todos')}
          className="text-[12px] font-medium text-cyan-700 hover:text-cyan-900 flex items-center gap-1 shrink-0 mt-0.5"
        >
          {vista === 'todos' ? '← Volver' : '▦ Ver todos'}
        </button>
      ) : null}
    >
      {cargando ? (
        <p className="text-sm text-slate-400 py-6 text-center">Cargando…</p>
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
        </div>
      ) : grupoActivo && (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <BloqueProceso
              titulo={grupoActivo.titulo}
              pasos={grupoActivo.pasos}
              celdas={celdas}
              seleccionado={pasoSeleccionado}
              onSeleccionar={setPasoSeleccionado}
              soloContenido
            />
          </div>

          {pasoActivo && (
            <div className="w-72 shrink-0">
              <PanelCelda
                subjectId={subjectId}
                paso={pasoActivo}
                celda={celdas[pasoActivo.path]}
                teachers={teachers}
                onGuardado={onGuardado}
                onCerrar={() => setPasoSeleccionado(null)}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
