/**
 * Rate limiter en memoria para proteger el endpoint de login.
 * Sin dependencias externas (Redis, etc.).
 *
 * Limita a MAX_INTENTOS intentos fallidos por cada combinacion IP+email
 * dentro de una ventana de WINDOW_MS milisegundos.
 */

const MAX_INTENTOS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

interface Registro {
  count: number;
  hasta: number;
}

const intentos = new Map<string, Registro>();

// Limpieza periodica de registros expirados para evitar memory leaks
setInterval(() => {
  const ahora = Date.now();
  for (const [key, reg] of intentos) {
    if (reg.hasta <= ahora) intentos.delete(key);
  }
}, 60_000);

function buildKey(ip: string, email: string): string {
  return ip + ':' + email.toLowerCase().trim();
}

/**
 * Registra un intento de login y devuelve si esta permitido.
 * @returns { permitido, restantes, retryAfter? }
 */
export function rateLimit(
  ip: string,
  email: string
): { permitido: boolean; restantes: number; retryAfter?: number } {
  const key = buildKey(ip, email);
  const ahora = Date.now();
  const registro = intentos.get(key);

  if (registro && registro.hasta > ahora) {
    if (registro.count >= MAX_INTENTOS) {
      const retryAfter = Math.ceil((registro.hasta - ahora) / 1000);
      return { permitido: false, restantes: 0, retryAfter };
    }
    registro.count++;
    return { permitido: true, restantes: MAX_INTENTOS - registro.count };
  }

  intentos.set(key, { count: 1, hasta: ahora + WINDOW_MS });
  return { permitido: true, restantes: MAX_INTENTOS - 1 };
}

/**
 * Resetea el contador de intentos para una IP+email (despues de un login exitoso).
 */
export function resetIntentos(ip: string, email: string): void {
  intentos.delete(buildKey(ip, email));
}
