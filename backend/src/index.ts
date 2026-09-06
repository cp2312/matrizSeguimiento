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
import { revisarContratosPorVencer } from './lib/contractWarnings.js';
import { revisarFechasLimite } from './lib/dueDateWarnings.js';

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

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

app.use((err: any, _req: any, res: any, _next: any) => {
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
setInterval(() => {
  void revisarContratosPorVencer();
  void revisarFechasLimite();
}, UN_DIA_MS);

httpServer.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});