import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

export function useFetch<T>(path: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(() => {
    if (!path) return setCargando(false);

    setCargando(true);
    api.get<T>(path)
      .then((d) => { setDatos(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [path]);

  useEffect(() => { recargar(); }, [recargar]);

  return { datos, cargando, error, recargar };
}