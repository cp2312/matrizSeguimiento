import { Router } from 'express';
import ExcelJS from 'exceljs';
import { query, queryOne } from '../db/pool.js';
import { cargarQuitadas, cargarQuitadasPorPrograma } from '../lib/removedInstances.js';
import {
  buildStepPaths, etiquetaPaso, pasosVisibles, pasosAplicables,
} from '../../../shared/pipelineTemplate.js';
import type { CellStatus, MatrixCell, Program, ResolvedStep, Subject, SubjectTeacher } from '../../../shared/types.js';

export const exportarRouter = Router();

// Mismos colores que usa el tablero (frontend/src/lib/estados.ts) -- se
// duplican acá porque el backend no puede importar del frontend. Si esos
// colores cambian algún día, hay que actualizar los dos lados.
const ESTADOS: Record<CellStatus, { label: string; fondo: string; texto: string }> = {
  vacio:            { label: 'Sin iniciar',    fondo: 'FFF1F0EC', texto: 'FF8A8578' },
  pendiente_equipo: { label: 'En proceso',     fondo: 'FFFFFFFF', texto: 'FFC0392B' },
  pendiente_jefe:   { label: 'Pendiente jefe', fondo: 'FFF5D061', texto: 'FFA32D2D' },
  ajustes:          { label: 'En ajustes',     fondo: 'FFF5D061', texto: 'FF1F1B16' },
  por_revisar:      { label: 'Por revisar',    fondo: 'FFFFFFFF', texto: 'FF1F1B16' },
  terminado:        { label: 'Terminado',      fondo: 'FF3F7D5C', texto: 'FFFFFFFF' },
};

/** 'YYYY-MM-DD' -> 'DD/MM', igual que fechaCorta del frontend (lib/estados.ts) */
function fechaCorta(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
}

/** Columnas fijas antes de los apartados del proceso */
const ENCABEZADOS_FIJOS: { titulo: string; ancho: number; color?: string; colorTexto?: string }[] = [
  { titulo: 'Semestre', ancho: 12, color: 'FF1F2937', colorTexto: 'FFFFFFFF' },
  { titulo: 'Asignatura', ancho: 28, color: 'FF1F2937', colorTexto: 'FFFFFFFF' },
  { titulo: 'Créditos', ancho: 9, color: 'FFBFDCEE' },
  { titulo: 'Modalidad', ancho: 12, color: 'FFBFDCEE' },
  { titulo: 'Programa Híbrido', ancho: 16, color: 'FFF5D061' },
  { titulo: 'Docentes', ancho: 26 },
  { titulo: 'Avance', ancho: 9 },
];
const COLOR_ENCABEZADO_FIJO = 'FFE2E8F0';

/**
 * Color de banda por bloque del proceso -- fijo por bloque (no rotando según
 * cuántos apartados vengan antes), para que "OVA 1" siempre sea del mismo
 * color sin importar los créditos. Un bloque repetible (OVA, Guía, Video de
 * contenido, Infografía) usa una lista corta que se repite por instancia, tal
 * como alternaba de color la matriz de Excel vieja. No son exactamente los
 * mismos códigos de color de esa matriz (esos vivían en su plantilla de
 * Excel, no hay forma de leerlos desde el PDF), pero siguen el mismo espíritu
 * de familia de color por apartado.
 */
const COLORES_POR_BLOQUE: Record<string, string | string[]> = {
  derechos: 'FFD8ECE0',
  contrato: 'FFEFE6D8',
  entregables: 'FFD8ECE0',
  libro: 'FFDCEEFB',
  unidad_grafica: 'FFFBE0C7',
  estructura: 'FFFDE9C8',
  rutas: 'FFD8ECE0',
  ovas: ['FFD8ECE0', 'FFFDE9C8', 'FFFBE0D4'],
  podcast: 'FFD8ECE0',
  video_bienvenida: 'FFDCE7F0',
  video_contenido: ['FFD8ECE0', 'FFEAF3E2'],
  infografia: ['FFFBE0C7', 'FFDCEEFB'],
  cuestionario_final: 'FFE7E5E0',
  guias: ['FFFBE0D4', 'FFDCEEFB'],
  contenidos_apoyo: 'FFD8ECE0',
  syllabus: 'FFDCEEFB',
  montaje_plataforma: 'FFE4E0F5',
  ruta_visual: 'FFEFE6D8',
  revision_final: 'FFE7E5E0',
};
const COLOR_BLOQUE_DEFECTO = 'FFEFEFEF';

function colorDeApartado(blockKey: string, instance: number | null): string {
  const entrada = COLORES_POR_BLOQUE[blockKey] ?? COLOR_BLOQUE_DEFECTO;
  if (typeof entrada === 'string') return entrada;
  const idx = instance ? (instance - 1) % entrada.length : 0;
  return entrada[idx];
}

interface ApartadoColumnas {
  /** clave del apartado: blockKey, o "blockKey.instancia" para bloques repetibles */
  clave: string;
  titulo: string;
  columnas: ResolvedStep[];
}

/**
 * Agrupa las columnas del proceso por apartado -- mismo criterio que
 * agruparPasos en el frontend (frontend/src/lib/bloques.ts): un paso
 * repetible DENTRO de su bloque (p. ej. los reintentos de Turnitin en
 * "Libro") no forma su propio apartado, sigue junto al resto del bloque.
 * Se duplica acá en vez de importar del frontend por la misma razón que
 * ESTADOS de arriba.
 */
function agruparPorApartado(columnas: ResolvedStep[]): ApartadoColumnas[] {
  const porClave = new Map<string, ApartadoColumnas>();

  for (const p of columnas) {
    // p.blockLabel ya trae el número de instancia incluido cuando el BLOQUE
    // es repetible (ver buildStepPaths) -- p. ej. "OVA 1". Un paso repetible
    // DENTRO de su bloque (p. ej. los reintentos de Turnitin en "Libro") no
    // forma su propio apartado, sigue junto al resto del bloque.
    const instanciaDeBloque = p.instance && !p.step.repeatable ? p.instance : null;
    const clave = instanciaDeBloque ? `${p.blockKey}.${instanciaDeBloque}` : p.blockKey;

    const existente = porClave.get(clave);
    if (existente) existente.columnas.push(p);
    else porClave.set(clave, { clave, titulo: p.blockLabel, columnas: [p] });
  }

  return [...porClave.values()];
}

/** Nombre de hoja válido para Excel: máx 31 caracteres, sin \ / ? * [ ] : */
function nombreHojaValido(nombre: string): string {
  const limpio = nombre.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return limpio || 'Hoja';
}

/**
 * Arma una hoja con una fila por asignatura y una columna por cada paso
 * posible del proceso (el superset de 5 créditos, así una asignatura con
 * menos créditos simplemente deja esas columnas de más en blanco). La usan
 * tanto el export de toda la matriz (una hoja por programa) como el export
 * de una sola asignatura (una hoja con una sola fila).
 */
function construirHoja(
  libro: ExcelJS.Workbook,
  nombreHoja: string,
  asignaturas: Subject[],
  celdasPorAsignatura: Map<number, Record<string, MatrixCell>>,
  docentesPorAsignatura: Map<number, string>,
  quitadasPorAsignatura: Map<number, ReadonlySet<string>>
) {
  const columnas = buildStepPaths(5);
  const apartados = agruparPorApartado(columnas);

  const hoja = libro.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', xSplit: ENCABEZADOS_FIJOS.length, ySplit: 2 }],
  });

  // Dos filas de encabezado, como la matriz vieja: la de arriba agrupa por
  // apartado (una banda de color fundida sobre todas sus columnas, p. ej.
  // "OVA 1"), la de abajo nombra cada paso puntual dentro de ese apartado.
  // Las columnas fijas (Semestre, Créditos...) no tienen paso puntual, así
  // que su título ocupa las dos filas fundidas verticalmente.
  const filaGrupos = hoja.addRow([]);
  const filaPasos = hoja.addRow([]);
  filaGrupos.height = 22;
  filaPasos.height = 46;

  ENCABEZADOS_FIJOS.forEach((col, i) => {
    const columna = i + 1;
    hoja.mergeCells(filaGrupos.number, columna, filaPasos.number, columna);
    const celda = filaGrupos.getCell(columna);
    celda.value = col.titulo;
    celda.font = { bold: true, color: col.colorTexto ? { argb: col.colorTexto } : undefined };
    celda.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.color ?? COLOR_ENCABEZADO_FIJO } };
    hoja.getColumn(columna).width = col.ancho;
  });

  let columna = ENCABEZADOS_FIJOS.length + 1;
  apartados.forEach((apartado) => {
    const p0 = apartado.columnas[0];
    const color = colorDeApartado(p0.blockKey, p0.instance);
    const inicio = columna;

    for (const p of apartado.columnas) {
      const celdaPaso = filaPasos.getCell(columna);
      celdaPaso.value = etiquetaPaso(p.step, p.instance);
      celdaPaso.font = { bold: true };
      celdaPaso.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      celdaPaso.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      hoja.getColumn(columna).width = 16;
      columna++;
    }

    if (apartado.columnas.length > 1) {
      hoja.mergeCells(filaGrupos.number, inicio, filaGrupos.number, columna - 1);
    }
    const celdaGrupo = filaGrupos.getCell(inicio);
    celdaGrupo.value = apartado.titulo;
    celdaGrupo.font = { bold: true };
    celdaGrupo.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    celdaGrupo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });

  for (const a of asignaturas) {
    const celdasAsig = celdasPorAsignatura.get(a.id) ?? {};
    const quitadas = quitadasPorAsignatura.get(a.id) ?? new Set<string>();

    // Mismo cálculo de avance que usa el tablero: solo cuenta los pasos que
    // de verdad aplican a ESTA asignatura según sus créditos reales.
    const visibles = pasosVisibles(
      pasosAplicables(buildStepPaths(a.credits), celdasAsig, quitadas), celdasAsig
    );
    const terminados = visibles.filter((p) => celdasAsig[p.path]?.status === 'terminado').length;
    const avance = visibles.length ? Math.round((terminados / visibles.length) * 100) : 0;

    const fila = hoja.addRow([
      a.semester,
      a.name,
      a.credits,
      a.modality === 'virtual' ? 'Virtual' : a.modality === 'presencial' ? 'Presencial' : '',
      a.hybrid_program_label ?? '',
      docentesPorAsignatura.get(a.id) ?? '',
      `${avance}%`,
    ]);
    fila.height = 30;

    columnas.forEach((p, i) => {
      const columna = ENCABEZADOS_FIJOS.length + 1 + i;
      const celda = celdasAsig[p.path];
      const cell = fila.getCell(columna);

      // Instancia que el equipo quitó a mano (p. ej. "OVA 1" que al final
      // no se hizo) -- se distingue de "vacío" para que no parezca que
      // sigue pendiente en el Excel.
      if (p.instance !== null && quitadas.has(`${p.blockKey}.${p.instance}`)) {
        cell.value = 'No aplica';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.font = { color: { argb: 'FF94A3B8' }, italic: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        return;
      }

      if (!celda || celda.status === 'vacio') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ESTADOS.vacio.fondo } };
        return;
      }

      const e = ESTADOS[celda.status];
      // Mismo formato que la ficha del paso en la app: "Terminado · 14/09 · CF"
      // (estado · fecha corta · iniciales), o la decisión tomada si es un
      // punto de "¿hay ajustes?".
      cell.value = p.step.isBranchPoint
        ? celda.branch_value === true
          ? 'Sí hay ajustes'
          : celda.branch_value === false
            ? 'No hay ajustes'
            : 'Sin decidir'
        : celda.done_date
          ? `${e.label} · ${fechaCorta(celda.done_date)} · ${celda.initials ?? ''}`
          : e.label;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.fondo } };
      cell.font = { color: { argb: e.texto } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      const detalle = [
        celda.comment ? `Comentario: ${celda.comment}` : null,
        celda.second_comment ? `Segundo comentario: ${celda.second_comment}` : null,
      ].filter(Boolean).join('\n');
      if (detalle) {
        cell.note = { texts: [{ text: detalle }] };
      }
    });
  }
}

function enviarLibro(res: import('express').Response, libro: ExcelJS.Workbook, nombreArchivo: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  return libro.xlsx.write(res).then(() => res.end());
}

// Excel de toda la matriz: una hoja por programa activo.
exportarRouter.get('/exportar', async (_req, res) => {
  const programas = await query<Program>(
    `SELECT * FROM programs WHERE NOT archived ORDER BY name`
  );

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Matriz de Seguimiento';
  libro.created = new Date();

  const nombresUsados = new Set<string>();

  for (const programa of programas) {
    const asignaturas = await query<Subject>(
      `SELECT * FROM subjects WHERE program_id = $1 AND NOT archived ORDER BY semester, name`,
      [programa.id]
    );
    if (!asignaturas.length) continue;

    const celdas = await query<MatrixCell>(
      `SELECT c.* FROM matrix_cells c JOIN subjects s ON s.id = c.subject_id WHERE s.program_id = $1`,
      [programa.id]
    );
    const celdasPorAsignatura = new Map<number, Record<string, MatrixCell>>();
    for (const c of celdas) {
      const mapa = celdasPorAsignatura.get(c.subject_id) ?? {};
      mapa[c.step_path] = c;
      celdasPorAsignatura.set(c.subject_id, mapa);
    }

    const docentes = await query<SubjectTeacher>(
      `SELECT t.* FROM subject_teachers t JOIN subjects s ON s.id = t.subject_id
       WHERE s.program_id = $1 ORDER BY t.id`,
      [programa.id]
    );
    const docentesPorAsignatura = new Map<number, string>();
    for (const d of docentes) {
      const previo = docentesPorAsignatura.get(d.subject_id);
      docentesPorAsignatura.set(d.subject_id, previo ? `${previo}, ${d.full_name}` : d.full_name);
    }

    const quitadasPorAsignatura = await cargarQuitadasPorPrograma(programa.id);

    // Nombre de hoja único (dos programas podrían compartir nombre, o uno
    // llamarse igual truncado a 31 caracteres)
    const base = nombreHojaValido(programa.name);
    let nombreHoja = base;
    let sufijo = 2;
    while (nombresUsados.has(nombreHoja.toLowerCase())) {
      nombreHoja = nombreHojaValido(`${base} (${sufijo++})`);
    }
    nombresUsados.add(nombreHoja.toLowerCase());

    construirHoja(libro, nombreHoja, asignaturas, celdasPorAsignatura, docentesPorAsignatura, quitadasPorAsignatura);
  }

  if (!libro.worksheets.length) {
    libro.addWorksheet('Sin datos').addRow(['Todavía no hay programas con asignaturas para exportar.']);
  }

  const nombreArchivo = `matriz-seguimiento-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await enviarLibro(res, libro, nombreArchivo);
});

// Excel de una sola asignatura -- mismo formato, una sola hoja con una sola fila.
exportarRouter.get('/subjects/:id/exportar', async (req, res) => {
  const asignatura = await queryOne<Subject>('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
  if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

  const celdas = await query<MatrixCell>('SELECT * FROM matrix_cells WHERE subject_id = $1', [req.params.id]);
  const celdasPorAsignatura = new Map<number, Record<string, MatrixCell>>([
    [asignatura.id, Object.fromEntries(celdas.map((c) => [c.step_path, c]))],
  ]);

  const docentes = await query<SubjectTeacher>(
    'SELECT * FROM subject_teachers WHERE subject_id = $1 ORDER BY id', [req.params.id]
  );
  const docentesPorAsignatura = new Map<number, string>([
    [asignatura.id, docentes.map((d) => d.full_name).join(', ')],
  ]);

  const quitadas = await cargarQuitadas(req.params.id);
  const quitadasPorAsignatura = new Map<number, ReadonlySet<string>>([[asignatura.id, quitadas]]);

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Matriz de Seguimiento';
  libro.created = new Date();

  construirHoja(
    libro, nombreHojaValido(asignatura.name), [asignatura],
    celdasPorAsignatura, docentesPorAsignatura, quitadasPorAsignatura
  );

  const nombreArchivo = `matriz-${nombreHojaValido(asignatura.name)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await enviarLibro(res, libro, nombreArchivo);
});
