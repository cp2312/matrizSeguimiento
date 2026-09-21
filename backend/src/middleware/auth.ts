import type { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { queryOne } from '../db/pool.js';
import type { User } from '../../../shared/types.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('Falta JWT_SECRET en el archivo .env');

/**
 * Interpreta JWT_EXPIRES_IN, que puede venir como segundos ("28800"), minutos
 * ("480m") u horas/días ("8h", "2d") -- con el mismo formato que acepta jsonwebtoken.
 * Devuelve los SEGUNDOS de vigencia (lo que el cliente necesita para saber
 * cuándo le expira el token en su reloj). Si no está configurado o no se
 * entiende, usa 8 horas por defecto.
 */
const SEGUNDOS_VIGENCIA_DEFAULT = 8 * 60 * 60;

function calcularVigencia(): { segundos: number; jwt: SignOptions['expiresIn'] } {
  const raw = (process.env.JWT_EXPIRES_IN ?? '').trim().toLowerCase();
  const match = /^(\d+)([smhd]?)$/.exec(raw);

  if (!match) return { segundos: SEGUNDOS_VIGENCIA_DEFAULT, jwt: SEGUNDOS_VIGENCIA_DEFAULT };

  const cantidad = Number(match[1]);
  const unidad = match[2] || 's';
  const porUnidad: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return { segundos: cantidad * porUnidad[unidad], jwt: raw as SignOptions['expiresIn'] };
}

const VIGENCIA = calcularVigencia();

export interface AuthUser {
  id: number;
  initials: string;
  role: 'usuario' | 'administrador';
  full_name: string;
  avatar_url: string | null;
}

// Extiende el tipo Request de Express para incluir el usuario
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function firmarToken(usuario: AuthUser): { token: string; expiresIn: number } {
  const token = jwt.sign(
    { sub: usuario.id, initials: usuario.initials, role: usuario.role },
    JWT_SECRET!,
    { expiresIn: VIGENCIA.jwt }
  );
  return { token, expiresIn: VIGENCIA.segundos };
}


export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta el token de sesión' });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET!) as unknown as { sub: number };

    
    const usuario = await queryOne<User>(
      `SELECT id, full_name, initials, role, active, avatar_url FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (!usuario || !usuario.active) {
      return res.status(401).json({ error: 'Sesión no válida' });
    }

    req.user = {
      id: usuario.id,
      initials: usuario.initials,
      role: usuario.role,
      full_name: usuario.full_name,
      avatar_url: usuario.avatar_url ?? null,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}


export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'administrador') {
    return res.status(403).json({ error: 'Se requiere rol de administrador' });
  }
  next();
}