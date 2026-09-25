import { useState } from 'react';
import { api } from '../lib/api';
import { ModalApartado } from './ModalApartado';
import { ItemApartado } from './ItemApartado';
import { ModalConfirmar } from './ui/ModalConfirmar';
import { Alerta } from './ui/Alerta';
import { separarGruposVisibles } from '../lib/bloques';
import type { GrupoPasos } from '../lib/bloques';
import type { MatrixCell, SubjectTeacher } from '@shared/types';

function IconoCandado({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

interface Props {
  subjectId: number;
  grupos: Record<string, GrupoPasos>;
  celdas: Record<string, MatrixCell>;
  /** claves "bloque.instancia" de instancias garantizadas quitadas a mano (ver useMatriz) */
  quitadas?: ReadonlySet<string>;
  teachers: SubjectTeacher[];
  videoPorDocente: boolean;
  bookDueDate: string | null;
  onGuardado: (celda: MatrixCell) => void;
  onTeachersChanged: (teachers: SubjectTeacher[]) => void;
  onCambiarVideoPorDocente: (checked: boolean) => void;
  onBookDueDateChanged: (bookDueDate: string | null) => void;
  /** apartado con el que abrir de una vez (p. ej. el link "?apartado=" de un correo de aviso) */
  apartadoInicial?: string | null;
  onRecargar?: () => void;
}

/**
 * En vez de desplegar los ~25 apartados del proceso a la vez, muestra una
 * lista compacta con el avance de cada uno; al hacer clic se abre solo ese
 * apartado en una ventana flotante (ver ModalApartado).
 */
export function ApartadosAsignatura({
  subjectId, grupos, celdas, quitadas, teachers, videoPorDocente, bookDueDate,
  onGuardado, onTeachersChanged, onCambiarVideoPorDocente, onBookDueDateChanged, apartadoInicial, onRecargar,
}: Props) {
  const [apartado, setApartado] = useState<string | null>(apartadoInicial ?? null);

  // Un bloque repetible (OVA, Podcast, Video de contenido, Guía, Infografía)
  // puede tener instancias extra ocultas más allá de lo que corresponde por
  // créditos, o instancias garantizadas que se quitaron a mano -- ninguna se
  // muestra como tarjeta hasta que se agregan/restauran.
  const { visibles, paraAgregar } = separarGruposVisibles(grupos, celdas, quitadas);

  // "Quitar" pide confirmación con el modal propio de la app (no el nativo
  // del navegador) -- se pierde avance guardado, así que sigue avisando antes.
  const [quitando, setQuitando] = useState<{ blockKey: string; instance: number; etiqueta: string } | null>(null);
  const [enviandoQuitar, setEnviandoQuitar] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState('');
  // Restaurar/desbloquear no son destructivos -- no piden confirmación, solo
  // muestran el error acá si algo falla (en vez del alert nativo).
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

  async function desbloquearApartado(blockKey: string) {
    setErrorAccion('');
    try {
      await api.post(`/subjects/${subjectId}/blocks/${blockKey}/desbloquear`, {});
      onRecargar?.();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : 'No se pudo desbloquear');
    }
  }

  return (
    <>
      <Alerta>{errorAccion}</Alerta>

      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(visibles).map(([clave, g]) => {
          const p0 = g.pasos[0];
          const esInstancia = p0 && p0.instance !== null;
          return (
            <ItemApartado
              key={clave}
              titulo={g.titulo}
              pasos={g.pasos}
              celdas={celdas}
              onClick={() => setApartado(clave)}
              onEliminar={esInstancia ? () => setQuitando({ blockKey: p0.blockKey, instance: p0.instance!, etiqueta: g.titulo }) : undefined}
            />
          );
        })}

        {paraAgregar.map(({ clave, etiqueta, blockKey, instance, accion }) =>
          accion === 'desbloquear-bloque' ? (
            <button
              key={clave}
              type="button"
              onClick={() => desbloquearApartado(blockKey)}
              title={`${etiqueta}: no aplica a esta asignatura -- clic para desbloquear`}
              className="flex items-center gap-2 px-3.5 h-11 rounded-lg border border-dashed border-slate-300 dark:border-slate-600
                         bg-slate-50/60 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 text-[13px] text-left italic
                         transition-colors hover:border-slate-400 dark:hover:border-slate-500"
            >
              <IconoCandado className="w-3 h-3 shrink-0" />
              {etiqueta} — bloqueado
            </button>
          ) : (
            <button
              key={clave}
              type="button"
              onClick={() => {
                if (accion === 'restaurar') restaurarInstancia(blockKey, instance);
                setApartado(clave);
              }}
              className="flex items-center gap-2.5 px-3.5 h-11 rounded-lg border border-dashed border-slate-300 dark:border-slate-700
                         text-slate-400 dark:text-slate-500 text-[13px] text-left transition-colors
                         hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-white/5 hover:bg-slate-50"
            >
              + Agregar {etiqueta}
            </button>
          )
        )}
      </div>

      <ModalApartado
        key={apartado}
        abierto={!!apartado}
        subjectId={subjectId}
        grupos={grupos}
        celdas={celdas}
        quitadas={quitadas}
        teachers={teachers}
        apartadoInicial={apartado}
        videoPorDocente={videoPorDocente}
        onCambiarVideoPorDocente={onCambiarVideoPorDocente}
        bookDueDate={bookDueDate}
        onBookDueDateChanged={onBookDueDateChanged}
        onGuardado={onGuardado}
        onTeachersChanged={onTeachersChanged}
        onCerrar={() => setApartado(null)}
        onRecargar={onRecargar}
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
    </>
  );
}
