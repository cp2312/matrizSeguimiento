import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query, queryOne } from './db/pool.js';
import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { programsRouter } from './routes/programs.js';
import { subjectsRouter } from './routes/subjects.js';
import { buildMatrixRouter } from './routes/matrix.js';
import { encargadosRouter } from './routes/encargados.js';
import { subjectEncargadosRouter } from './routes/subjectEncargados.js';
import { auditoriaRouter } from './routes/auditoria.js';
import { exportarRouter } from './routes/exportar.js';
import { pendientesRouter } from './routes/pendientes.js';
import { settingsRouter } from './routes/settings.js';
import { revisarContratosPorVencer } from './lib/contractWarnings.js';
import { revisarFechasLimite } from './lib/dueDateWarnings.js';
import { revisarLibroNoEntregado } from './lib/bookWarnings.js';

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: CLIENT_ORIGIN }));
// 4 MB para que quepa la foto de perfil (hasta 3 MB en base64) -- con el
// límite por defecto (100 kb) un avatar se rechazaba aunque el backend lo
// acepte.
app.use(express.json({ limit: '4mb' }));

const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

// Público
app.get('/api/health', async (_req, res) => {
  const rows = await query('SELECT COUNT(*) AS total FROM subjects');
  res.json({ ok: true, asignaturas: Number(rows[0].total) });
});

app.use('/api/auth', authRouter);

// Todo lo demás exige sesión
app.use('/api/programs', requireAuth, programsRouter);
app.use('/api', requireAuth, subjectsRouter);
app.use('/api', requireAuth, buildMatrixRouter(io));
app.use('/api', requireAuth, encargadosRouter);
app.use('/api', requireAuth, subjectEncargadosRouter);
app.use('/api', requireAuth, auditoriaRouter);
app.use('/api', requireAuth, exportarRouter);
app.use('/api', requireAuth, pendientesRouter);
app.use('/api', requireAuth, settingsRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  // JSON malformado del cliente -> 400, no un 500 genérico
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }
  // Payload más grande que el límite (p. ej. una foto de más de 3 MB) -> 413
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La petición es demasiado grande' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Validación del token en las conexiones de socket
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) return next(new Error('Falta el token de sesión'));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as { sub: number };

    const usuario = await queryOne<any>(
      `SELECT id, initials, role, active FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (!usuario?.active) return next(new Error('Sesión no válida'));

    socket.data.user = usuario;
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  socket.on('subject:join', (id: number) => socket.join(`subject:${id}`));
  socket.on('subject:leave', (id: number) => socket.leave(`subject:${id}`));
});

// Revisa contratos y fechas límite por vencer una vez al arrancar (para no
// esperar un día entero en un despliegue nuevo) y despues cada 24h. Es un
// solo proceso siempre corriendo -- no hace falta un runner de cron aparte.
const UN_DIA_MS = 24 * 60 * 60 * 1000;
void revisarContratosPorVencer();
void revisarFechasLimite();
void revisarLibroNoEntregado();
setInterval(() => {
  void revisarContratosPorVencer();
  void revisarFechasLimite();
  void revisarLibroNoEntregado();
}, UN_DIA_MS);

// Solo en 127.0.0.1 (loopback): Nginx, que corre en el mismo servidor, es
// quien se conecta a este puerto y expone la app a internet. No abrir en
// 0.0.0.0 deja el puerto 4000 sin exponer por fuera.
const BIND_HOST = '127.0.0.1';

httpServer.listen(PORT, BIND_HOST, () => {
  console.log(`API escuchando en http://${BIND_HOST}:${PORT}`);
});