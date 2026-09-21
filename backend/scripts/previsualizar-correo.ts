// Renderiza el correo de "Asignatura finalizada" a un HTML local para verlo en
// el navegador (con el GIF de confeti embebido como data URI). No envía nada.
//
// Uso: npm run previsualizar-correo -w backend
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construirHtmlAsignaturaCompleta } from '../src/lib/mailer.js';

const dir = dirname(fileURLToPath(import.meta.url));
const assets = join(dir, '..', 'assets');
const gif = readFileSync(join(assets, 'confetti.gif')).toString('base64');

let html = construirHtmlAsignaturaCompleta(
  {
    paraEmail: 'vista-previa@local',
    paraNombre: 'Equipo',
    asignatura: 'Metodología de la Investigación',
    programa: 'Especialización en Docencia Universitaria',
    linkAula: 'https://aulas.ejemplo.edu/metodologia-2026-2',
    subjectId: 1,
  },
  'http://localhost:5173/asignaturas/1',
);

html = html.replace('src="cid:confetti"', `src="data:image/gif;base64,${gif}"`);

const salida = join(assets, 'preview-correo.html');
writeFileSync(salida, `<!doctype html><meta charset="utf-8">${html}`, 'utf8');
console.log(`[preview] Vista previa generada en ${salida}`);
