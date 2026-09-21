// Genera backend/assets/confetti.gif: un banner animado de confeti cayendo,
// pensado para incrustarse como imagen inline (CID) en el correo de
// "Asignatura finalizada". El bucle es perfecto: cada partícula recorre un
// número entero de ciclos verticales/horizontales/giros en FRAMES cuadros.
//
// Uso: npm run generar-confetti -w backend
import gifenc from 'gifenc';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { GIFEncoder, applyPalette } = gifenc;

const WIDTH = 432;
const HEIGHT = 120;
const FRAMES = 30;
const DELAY_MS = 70;
const MARGEN_Y = 24;
const RECORRIDO_Y = HEIGHT + MARGEN_Y * 2;

// Fondo + colores de marca. Paleta fija para que no titile entre cuadros.
const PALETA = [
  [15, 23, 42], // #0F172A (fondo)
  [63, 125, 92], // #3F7D5C
  [134, 239, 172], // #86EFAC
  [253, 230, 138], // #FDE68A
  [253, 186, 116], // #FDBA74
  [255, 255, 255], // blanco
  [56, 189, 248], // #38BDF8
  [244, 114, 182], // #F472B6
];
const COLORES = PALETA.slice(1);

let semilla = 20260918;
function azar() {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
}

const particulas = Array.from({ length: 48 }, () => {
  const ciclosY = 1 + Math.floor(azar() * 3); // 1..3 vueltas verticales por bucle
  const derivaX = [-1, 0, 0, 1, 2][Math.floor(azar() * 5)]; // vueltas horizontales (enteras)
  const giros = 1 + Math.floor(azar() * 2); // giros completos por bucle
  return {
    x: azar() * WIDTH,
    y: azar() * RECORRIDO_Y,
    ancho: 4 + azar() * 5,
    alto: 5 + azar() * 6,
    velY: (ciclosY * RECORRIDO_Y) / FRAMES,
    velX: (derivaX * WIDTH) / FRAMES,
    velGiro: (giros * Math.PI * 2) / FRAMES,
    fase: azar() * Math.PI * 2,
    color: COLORES[Math.floor(azar() * COLORES.length)],
  };
});

function pintarParticula(buf, cx, cy, ancho, alto, cosA, color) {
  const mitadAncho = Math.max((ancho * Math.abs(cosA)) / 2, 0.5);
  const mitadAlto = alto / 2;
  const x0 = Math.floor(cx - mitadAncho);
  const x1 = Math.ceil(cx + mitadAncho);
  const y0 = Math.floor(cy - mitadAlto);
  const y1 = Math.ceil(cy + mitadAlto);
  for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= HEIGHT) continue;
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= WIDTH) continue;
      const o = (y * WIDTH + x) * 4;
      buf[o] = color[0];
      buf[o + 1] = color[1];
      buf[o + 2] = color[2];
      buf[o + 3] = 255;
    }
  }
}

const gif = GIFEncoder();

for (let i = 0; i < FRAMES; i++) {
  const buf = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const fondo = PALETA[0];
  for (let p = 0; p < WIDTH * HEIGHT; p++) {
    const o = p * 4;
    buf[o] = fondo[0];
    buf[o + 1] = fondo[1];
    buf[o + 2] = fondo[2];
    buf[o + 3] = 255;
  }

  for (const pt of particulas) {
    const y = ((pt.y + i * pt.velY) % RECORRIDO_Y) - MARGEN_Y;
    const x = (((pt.x + i * pt.velX) % WIDTH) + WIDTH) % WIDTH;
    const cosA = Math.cos(pt.fase + i * pt.velGiro);
    pintarParticula(buf, x, y, pt.ancho, pt.alto, cosA, pt.color);
  }

  const index = applyPalette(buf, PALETA);
  const opciones = { palette: PALETA, delay: DELAY_MS };
  if (i === 0) opciones.repeat = 0; // bucle infinito
  gif.writeFrame(index, WIDTH, HEIGHT, opciones);
}

gif.finish();

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'confetti.gif');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, gif.bytes());
console.log(`[confetti] GIF generado en ${destino}`);
