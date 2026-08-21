import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

export const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'matriz-api' });
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Cada asignatura es una "sala": así solo recibes los cambios de la matriz que estás viendo
  socket.on('subject:join', (subjectId: number) => {
    socket.join(`subject:${subjectId}`);
  });

  socket.on('subject:leave', (subjectId: number) => {
    socket.leave(`subject:${subjectId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});