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
const RUTAS_PUBLICAS = ['/auth/login', '/auth/refresh'];

// Cola de peticiones que fallaron mientras se refrescaba el token
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

function processQueue(error: Error | null, newToken: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newToken!);
  });
  failedQueue = [];
}

/**
 * Intenta refrescar el token usando el token actual (que aún es válido pero
 * está por expirar). Devuelve el nuevo token o lanza error.
 */
async function refreshAccessToken(): Promise<string> {
  const currentToken = token.get();
  if (!currentToken) throw new Error('No hay token');

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`,
    },
  });

  if (!res.ok) throw new Error('Refresh failed');

  const data = await res.json();
  token.set(data.token);
  token.setExpiry(data.expiresIn);
  return data.token;
}

/**
 * Verifica si el token está por expirar (menos de 5 minutos).
 * Si es así, intenta refresh silencioso antes de que la petición falle.
 */
async function ensureValidToken(): Promise<string | null> {
  const currentToken = token.get();
  if (!currentToken) return null;

  const expiry = token.getExpiry();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Token expirado o por expirar en menos de 5 minutos
  if (expiry - now < fiveMinutes) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        return newToken;
      } catch (err) {
        processQueue(err as Error, null);
        token.clear();
        const destino = location.pathname + location.search;
        location.href = `/login?from=${encodeURIComponent(destino)}`;
        throw err;
      } finally {
        isRefreshing = false;
      }
    }

    // Ya hay un refresh en curso: esperar a que termine
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({
        resolve: (newToken) => {
          // Reintentar la petición original con el nuevo token
          resolve(newToken);
        },
        reject,
      });
    });
  }

  return currentToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Asegurar que el token es válido antes de hacer la petición
  let t = await ensureValidToken();

  let res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...options.headers,
    },
  });

  // Si recibimos 401 y no es ruta pública, intentar refresh una vez
  if (res.status === 401 && !RUTAS_PUBLICAS.some((r) => path.startsWith(r))) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        t = newToken;

        // Reintentar la petición con el nuevo token
        res = await fetch(`${BASE}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });
      } catch (err) {
        processQueue(err as Error, null);
        token.clear();
        const destino = location.pathname + location.search;
        location.href = `/login?from=${encodeURIComponent(destino)}`;
        throw new ApiError(401, 'Sesión expirada');
      } finally {
        isRefreshing = false;
      }
    } else {
      // Ya hay un refresh en curso: esperar y reintentar
      t = await new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });

      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
          ...options.headers,
        },
      });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Error en la petición');
  }

  return res.status === 204 ? (null as T) : res.json();
}

export const api = {
  get:   <T>(path: string) => request<T>(path),
  post:  <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:   <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  del:   <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
