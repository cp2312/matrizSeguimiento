import { io, type Socket } from 'socket.io-client';
import { token } from './token';

let socket: Socket | null = null;

/**
 * Conexión compartida de Socket.IO, autenticada con el token de sesión.
 * No se conecta sola: quien la use decide cuándo conectar/desconectar
 * (ver useMatriz, que la abre mientras se ve una asignatura).
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      // Función en vez de valor fijo: relee el token en cada intento de conexión,
      // para que un login posterior no quede con el token viejo capturado.
      auth: (cb) => cb({ token: token.get() }),
    });
  }

  return socket;
}
