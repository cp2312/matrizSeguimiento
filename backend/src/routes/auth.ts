import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query, queryOne } from '../db/pool.js';
import { firmarToken, requireAuth, requireAdmin } from '../middleware/auth.js';
import { rateLimit, resetIntentos } from '../lib/rateLimit.js';

export const authRouter = Router();

const RONDAS_BCRYPT = 10;

// Login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  const usuario = await queryOne<any>(
    `SELECT * FROM users WHERE lower(email) = lower($1)`,
    [email.trim()]
  );

  if (!usuario || !usuario.active) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // Rate limiting: max 5 intentos fallidos por IP+email en 15 minutos
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const resultadoRL = rateLimit(ip, email);
  if (!resultadoRL.permitido) {
    return res.status(429).json({
      error: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
      retryAfter: resultadoRL.retryAfter,
    });
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // Login exitoso: resetear contador de intentos
  resetIntentos(ip, email);

  const datos = {
    id: usuario.id,
    initials: usuario.initials,
    role: usuario.role,
    full_name: usuario.full_name,
  };

  const { token: jwtToken, expiresIn } = firmarToken(datos);
  res.json({ token: jwtToken, expiresIn, usuario: datos });
});


authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Refresh: si el token actual es válido pero está por expirar, devuelve uno nuevo
authRouter.post('/refresh', requireAuth, (req, res) => {
  const datos = {
    id: req.user!.id,
    initials: req.user!.initials,
    role: req.user!.role,
    full_name: req.user!.full_name,
  };
  const { token: jwtToken, expiresIn } = firmarToken(datos);
  res.json({ token: jwtToken, expiresIn });
});


authRouter.post('/cambiar-password', requireAuth, async (req, res) => {
  const { passwordActual, passwordNueva } = req.body;

  if (!passwordNueva || passwordNueva.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const usuario = await queryOne<any>('SELECT * FROM users WHERE id = $1', [req.user!.id]);

  const coincide = await bcrypt.compare(passwordActual ?? '', usuario.password_hash);
  if (!coincide) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }

  const hash = await bcrypt.hash(passwordNueva, RONDAS_BCRYPT);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.id]);

  res.json({ ok: true });
});



authRouter.get('/usuarios', requireAuth, requireAdmin, async (_req, res) => {
  const usuarios = await query(
    `SELECT id, full_name, email, initials, role, active, created_at
     FROM users ORDER BY active DESC, full_name`
  );
  res.json(usuarios);
});

authRouter.post('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { fullName, email, initials, role, password } = req.body;

  if (!fullName?.trim() || !email?.trim() || !initials?.trim() || !password) {
    return res.status(400).json({ error: 'Nombre, correo, iniciales y contraseña son obligatorios' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const hash = await bcrypt.hash(password, RONDAS_BCRYPT);

  try {
    const usuario = await queryOne(
      `INSERT INTO users (full_name, email, password_hash, initials, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, initials, role, active, created_at`,
      [
        fullName.trim(),
        email.trim().toLowerCase(),
        hash,
        initials.trim().toUpperCase(),
        role === 'administrador' ? 'administrador' : 'usuario',
      ]
    );

    res.status(201).json(usuario);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese correo o esas iniciales ya están en uso' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Las iniciales deben ser 2 a 4 letras mayúsculas' });
    }
    throw err;
  }
});

authRouter.patch('/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const existente = await queryOne<any>('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!existente) return res.status(404).json({ error: 'Usuario no encontrado' });

  const { fullName, initials, role, active, password } = req.body;

  // Evita que el último administrador se quede sin acceso
  if ((role === 'usuario' || active === false) && existente.role === 'administrador') {
    const admins = await queryOne<any>(
      `SELECT COUNT(*)::int AS total FROM users WHERE role = 'administrador' AND active`
    );
    if (admins.total <= 1) {
      return res.status(400).json({ error: 'Debe quedar al menos un administrador activo' });
    }
  }

  const hash = password ? await bcrypt.hash(password, RONDAS_BCRYPT) : existente.password_hash;

  const usuario = await queryOne(
    `UPDATE users SET full_name=$1, initials=$2, role=$3, active=$4, password_hash=$5
     WHERE id=$6
     RETURNING id, full_name, email, initials, role, active`,
    [
      fullName?.trim() ?? existente.full_name,
      initials?.trim().toUpperCase() ?? existente.initials,
      role ?? existente.role,
      active !== undefined ? Boolean(active) : existente.active,
      hash,
      req.params.id,
    ]
  );

  res.json(usuario);
});