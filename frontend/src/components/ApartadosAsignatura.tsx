import { useState } from 'react';
import { ModalApartado } from './ModalApartado';
import { ItemApartado } from './ItemApartado';
import type { GrupoPasos } from '../lib/bloques';
import type { MatrixCell, SubjectTeacher } from '@shared/types';

interface Props {
  subjectId: number;
  grupos: Record<string, GrupoPasos>;
  celdas: Record<string, MatrixCell>;
  teachers: SubjectTeacher[];
  onGuardado: (celda: MatrixCell) => void;
  /** apartado con el que abrir de una vez (p. ej. el link "?apartado=" de un correo de aviso) */
  apartadoInicial?: string | null;
}

/**
 * En vez de desplegar los ~25 apartados del proceso a la vez, muestra una
 * lista compacta con el avance de cada uno; al hacer clic se abre solo ese
 * apartado en una ventana flotante (ver ModalApartado).
 */
export function ApartadosAsignatura({ subjectId, grupos, celdas, teachers, onGuardado, apartadoInicial }: Props) {
  const [apartado, setApartado] = useState<string | null>(apartadoInicial ?? null);

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(grupos).map(([clave, g]) => (
          <ItemApartado key={clave} titulo={g.titulo} pasos={g.pasos} celdas={celdas} onClick={() => setApartado(clave)} />
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
        onGuardado={onGuardado}
        onCerrar={() => setApartado(null)}
      />
    </>
  );
}
