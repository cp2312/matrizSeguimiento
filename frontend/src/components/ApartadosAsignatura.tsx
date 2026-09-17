import { useState } from 'react';
import { ModalApartado } from './ModalApartado';
import { ItemApartado } from './ItemApartado';
import { separarGruposVisibles } from '../lib/bloques';
import type { GrupoPasos } from '../lib/bloques';
import type { MatrixCell, SubjectTeacher } from '@shared/types';

interface Props {
  subjectId: number;
  grupos: Record<string, GrupoPasos>;
  celdas: Record<string, MatrixCell>;
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
  subjectId, grupos, celdas, teachers, videoPorDocente, bookDueDate,
  onGuardado, onTeachersChanged, onCambiarVideoPorDocente, onBookDueDateChanged, apartadoInicial, onRecargar,
}: Props) {
  const [apartado, setApartado] = useState<string | null>(apartadoInicial ?? null);

  // Un bloque extensible (hoy solo "Video de contenido") puede tener
  // instancias extra ocultas, más allá de lo que corresponde por créditos --
  // no se muestran como tarjeta hasta que se agregan a mano.
  const { visibles, siguientesExtra } = separarGruposVisibles(grupos, celdas);

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(visibles).map(([clave, g]) => (
          <ItemApartado key={clave} titulo={g.titulo} pasos={g.pasos} celdas={celdas} onClick={() => setApartado(clave)} />
        ))}

        {siguientesExtra.map(({ clave, etiqueta }) => (
          <button
            key={clave}
            type="button"
            onClick={() => setApartado(clave)}
            className="flex items-center gap-2.5 px-3.5 h-11 rounded-lg border border-dashed border-slate-300 dark:border-slate-700
                       text-slate-400 dark:text-slate-500 text-[13px] text-left transition-colors
                       hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-white/5 hover:bg-slate-50"
          >
            + Agregar {etiqueta}
          </button>
        ))}
      </div>

      <ModalApartado
        key={apartado}
        abierto={!!apartado}
        subjectId={subjectId}
        grupos={grupos}
        celdas={celdas}
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
    </>
  );
}
