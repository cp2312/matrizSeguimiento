import { token } from './token';

const BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/** Rutas donde un 401 significa credenciales incorrectas, no sesión vencida */
const RUTAS_PUBLICAS = ['/auth/login'];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const t = token.get();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    const sesionVencida =
      res.status === 401 && !RUTAS_PUBLICAS.some((r) => path.startsWith(r));

    if (sesionVencida) {
      token.clear();
      location.href = '/login';
    }

    throw new ApiError(res.status, body.error ?? 'Error en la petición');
  }

  return res.status === 204 ? (null as T) : res.json();
}

export const api = {
  get:   <T>(path: string) => request<T>(path),
  post:  <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  del:   <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};