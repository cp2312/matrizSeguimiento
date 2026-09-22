import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { pasosVisibles, pasosAplicables } from '@shared/pipelineTemplate';
import type { MatrixCell, ResolvedStep, Subject, SubjectTeacher } from '@shared/types';

interface RespuestaMatrizCruda {
  asignatura: Subject & { teachers: SubjectTeacher[] };
  pasos: ResolvedStep[];
  celdas: Record<string, MatrixCell>;
  /** claves "bloque.instancia" de instancias garantizadas que el equipo quitó a mano (ver matrix.ts) */
  quitadas: string[];
  avance: { terminados: number; total: number; porcentaje: number };
}

interface RespuestaMatriz extends Omit<RespuestaMatrizCruda, 'quitadas'> {
  quitadas: Set<string>;
}

export function useMatriz(subjectId: string | undefined) {
  const [datos, setDatos] = useState<RespuestaMatriz | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Número de petición en vuelo: si cambia la asignatura (o se recarga dos
  // veces seguidas), se descarta la respuesta de la petición anterior para
  // que no pise los datos de la asignatura nueva.
  const requestId = useRef(0);

  const recargar = useCallback(() => {
    if (!subjectId) return;
    const id = ++requestId.current;
    api.get<RespuestaMatrizCruda>(`/subjects/${subjectId}/matrix`)
      .then((d) => {
        if (requestId.current === id) { setDatos({ ...d, quitadas: new Set(d.quitadas) }); setError(null); }
      })
      .catch((e) => { if (requestId.current === id) setError(e.message); })
      .finally(() => { if (requestId.current === id) setCargando(false); });
  }, [subjectId]);

  // Al cambiar de asignatura se descarta lo que quede de la anterior de
  // inmediato (no solo cuando llegue la respuesta nueva), para que no se vea
  // un instante de una asignatura que ya no se está mirando. El estado se toca
  // un microinstante después (no de forma síncrona desde el efecto), para no
  // encadenar renders en el mismo commit.
  useEffect(() => {
    queueMicrotask(() => {
      setDatos(null);
      setError(null);
      setCargando(true);
    });
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
      const visibles = pasosVisibles(pasosAplicables(prev.pasos, celdas, prev.quitadas), celdas);
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