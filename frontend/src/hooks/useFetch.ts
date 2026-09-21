import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export function useFetch<T>(path: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Número de petición en vuelo: si cambia el path (o se llama recargar dos
  // veces seguidas), una respuesta vieja que llegue después se descarta y no
  // pisa los datos de la consulta nueva.
  const requestId = useRef(0);

  // El estado se toca un microinstante después de llamarse (no de forma
  // síncrona desde el efecto), para no encadenar renders en el mismo commit.
  const recargar = useCallback(() => {
    queueMicrotask(() => {
      if (!path) return setCargando(false);

      const id = ++requestId.current;
      setCargando(true);
      api.get<T>(path)
        .then((d) => { if (requestId.current === id) { setDatos(d); setError(null); } })
        .catch((e) => { if (requestId.current === id) setError(e instanceof Error ? e.message : 'Ocurrió un error'); })
        .finally(() => { if (requestId.current === id) setCargando(false); });
    });
  }, [path]);

  useEffect(() => { recargar(); }, [recargar]);

  return { datos, cargando, error, recargar };
}