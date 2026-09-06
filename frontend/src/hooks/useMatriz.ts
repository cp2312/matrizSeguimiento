import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { pasosVisibles, excluirInstanciasExtraSinUsar } from '@shared/pipelineTemplate';
import type { MatrixCell, ResolvedStep, Subject, SubjectTeacher } from '@shared/types';

interface RespuestaMatriz {
  asignatura: Subject & { teachers: SubjectTeacher[] };
  pasos: ResolvedStep[];
  celdas: Record<string, MatrixCell>;
  avance: { terminados: number; total: number; porcentaje: number };
}

export function useMatriz(subjectId: string | undefined) {
  const [datos, setDatos] = useState<RespuestaMatriz | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(() => {
    if (!subjectId) return;
    api.get<RespuestaMatriz>(`/subjects/${subjectId}/matrix`)
      .then((d) => { setDatos(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [subjectId]);

  useEffect(() => { recargar(); }, [recargar]);

  /**
   * Aplica una celda actualizada sin volver a pedir toda la matriz. Recalcula
   * el avance con la misma lógica que usa el backend (no solo reusar el total
   * anterior) porque puede cambiar: guardar el primer dato de una instancia
   * extra de un bloque extensible (p. ej. un segundo "Video de contenido")
   * la revela y suma sus pasos al total en el momento.
   */
  const aplicarCelda = useCallback((celda: MatrixCell) => {
    setDatos((prev) => {
      if (!prev) return prev;

      const celdas = { ...prev.celdas, [celda.step_path]: celda };
      const visibles = pasosVisibles(excluirInstanciasExtraSinUsar(prev.pasos, celdas), celdas);
      const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;

      return {
        ...prev,
        celdas,
        avance: {
          terminados,
          total: visibles.length,
          porcentaje: Math.round((terminados / visibles.length) * 100),
        },
      };
    });
  }, []);

  /** Aplica la lista de docentes actualizada sin volver a pedir toda la matriz */
  const aplicarTeachers = useCallback((teachers: SubjectTeacher[]) => {
    setDatos((prev) => (prev ? { ...prev, asignatura: { ...prev.asignatura, teachers } } : prev));
  }, []);

  // Tiempo real: mientras se ve esta asignatura, refleja los cambios que
  // guarden otros usuarios sin tener que refrescar la página.
  useEffect(() => {
    if (!subjectId) return;

    const socket = getSocket();
    const id = Number(subjectId);

    const unirse = () => socket.emit('subject:join', id);
    const onCellUpdated = (celda: MatrixCell) => {
      if (celda.subject_id === id) aplicarCelda(celda);
    };

    socket.on('connect', unirse);
    socket.on('cell:updated', onCellUpdated);
    socket.connect();
    if (socket.connected) unirse();

    return () => {
      socket.emit('subject:leave', id);
      socket.off('connect', unirse);
      socket.off('cell:updated', onCellUpdated);
      socket.disconnect();
    };
  }, [subjectId, aplicarCelda]);

  return { datos, cargando, error, recargar, aplicarCelda, aplicarTeachers };
}