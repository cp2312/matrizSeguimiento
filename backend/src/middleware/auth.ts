import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/pool.js';
import type { User } from '../../../shared/types.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('Falta JWT_SECRET en el archivo .env');

export interface AuthUser {
  id: number;
  initials: string;
  role: 'usuario' | 'administrador';
  full_name: string;
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
  const expiresIn = 3600; // 1 hora
  const token = jwt.sign(
    { sub: usuario.id, initials: usuario.initials, role: usuario.role },
    JWT_SECRET!,
    { expiresIn }
  );
  return { token, expiresIn };
}


export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta el token de sesión' });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET!) as unknown as { sub: number };

    
    const usuario = await queryOne<User>(
      `SELECT id, full_name, initials, role, active FROM users WHERE id = $1`,
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