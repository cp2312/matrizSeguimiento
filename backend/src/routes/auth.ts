import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { query, queryOne } from '../db/pool.js';
import { firmarToken, requireAuth, requireAdmin } from '../middleware/auth.js';
import { rateLimit, resetIntentos } from '../lib/rateLimit.js';
import { enviarCorreoRecuperacion } from '../lib/mailer.js';

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
    avatar_url: usuario.avatar_url ?? null,
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
    avatar_url: req.user!.avatar_url ?? null,
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


// Foto de perfil: se guarda como data URL base64. NULL la quita.
const AVATAR_MAX_BYTES = 3 * 1024 * 1024; // 3 MB aprox. en base64

authRouter.patch('/avatar', requireAuth, async (req, res) => {
  const { avatar } = req.body;

  if (avatar !== null && avatar !== undefined) {
    if (typeof avatar !== 'string') {
      return res.status(400).json({ error: 'Foto de perfil no válida' });
    }

    const mime = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.exec(avatar);
    if (!mime) {
      return res.status(400).json({ error: 'La foto debe ser una imagen (PNG, JPG o WebP)' });
    }

    if (avatar.length > AVATAR_MAX_BYTES) {
      return res.status(400).json({ error: 'La foto es muy pesada (máximo 3 MB)' });
    }
  }

  const avatarFinal = avatar ?? null;

  const usuario = await queryOne(
    `UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2
     RETURNING id, full_name, email, initials, role, active, avatar_url`,
    [avatarFinal, req.user!.id]
  );

  res.json({ ok: true, usuario: usuario!.avatar_url ?? null });
});


// Cuánto dura vigente el link de "olvidé mi contraseña"
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Olvidé mi contraseña: pide el correo y, si existe una cuenta activa, le
// manda un link de un solo uso para restablecerla. Responde siempre lo mismo
// para no revelar si ese correo está registrado.
authRouter.post('/olvido-password', async (req, res) => {
  const { email } = req.body;
  const RESPUESTA_GENERICA = { ok: true, message: 'Si el correo existe, enviamos un enlace para restablecer la contraseña' };

  if (!email?.trim()) {
    return res.status(400).json({ error: 'El correo es obligatorio' });
  }

  // Limita cuántas veces se puede pedir el envío por IP+correo, para que no
  // se use este endpoint para bombardear una bandeja de entrada
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const resultadoRL = rateLimit(ip, email, 'reset-password');
  if (!resultadoRL.permitido) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
      retryAfter: resultadoRL.retryAfter,
    });
  }

  const usuario = await queryOne<any>(
    `SELECT * FROM users WHERE lower(email) = lower($1)`,
    [email.trim()]
  );

  if (!usuario || !usuario.active) {
    return res.json(RESPUESTA_GENERICA);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEn = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await query(
    'UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3',
    [hashToken(token), expiraEn, usuario.id]
  );

  await enviarCorreoRecuperacion({
    paraEmail: usuario.email,
    paraNombre: usuario.full_name,
    token,
  });

  res.json(RESPUESTA_GENERICA);
});

// Restablecer contraseña: valida el token del link del correo y guarda la
// nueva contraseña. El token es de un solo uso -- se invalida al usarlo.
authRouter.post('/restablecer-password', async (req, res) => {
  const { token, passwordNueva } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Falta el token de recuperación' });
  }
  if (!passwordNueva || passwordNueva.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const usuario = await queryOne<any>(
    `SELECT * FROM users
     WHERE reset_token_hash = $1 AND reset_token_expires_at > now() AND active`,
    [hashToken(token)]
  );

  if (!usuario) {
    return res.status(400).json({ error: 'El enlace no es válido o ya venció. Solicita uno nuevo.' });
  }

  const hash = await bcrypt.hash(passwordNueva, RONDAS_BCRYPT);
  await query(
    'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2',
    [hash, usuario.id]
  );

  res.json({ ok: true });
});



authRouter.get('/usuarios', requireAuth, requireAdmin, async (_req, res) => {
  const usuarios = await query(
    `SELECT id, full_name, email, initials, role, active, avatar_url, created_at
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
       RETURNING id, full_name, email, initials, role, active, avatar_url, created_at`,
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
      return res.status(409).json({ error: 'Ese correo ya está en uso' });
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
     RETURNING id, full_name, email, initials, role, active, avatar_url`,
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