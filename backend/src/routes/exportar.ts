import { Router } from 'express';
import ExcelJS from 'exceljs';
import { query } from '../db/pool.js';
import { cargarQuitadasPorPrograma } from '../lib/removedInstances.js';
import {
  buildStepPaths, etiquetaPaso, pasosVisibles, pasosAplicables,
} from '../../../shared/pipelineTemplate.js';
import type { CellStatus, MatrixCell, Program, Subject, SubjectTeacher } from '../../../shared/types.js';

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

const ENCABEZADOS_FIJOS = ['Semestre', 'Asignatura', 'Créditos', 'Modalidad', 'Docentes', 'Avance'];

/** Nombre de hoja válido para Excel: máx 31 caracteres, sin \ / ? * [ ] : */
function nombreHojaValido(nombre: string): string {
  const limpio = nombre.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return limpio || 'Programa';
}

/**
 * Excel de toda la matriz: una hoja por programa activo, una fila por
 * asignatura y una columna por cada paso posible del proceso (el mismo
 * superset de 5 créditos para todas las filas, así la hoja queda con
 * columnas fijas igual que el Excel original -- una asignatura con menos
 * créditos simplemente deja esas columnas de más en blanco).
 */
exportarRouter.get('/exportar', async (_req, res) => {
  const columnas = buildStepPaths(5);

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

    const hoja = libro.addWorksheet(nombreHoja, {
      views: [{ state: 'frozen', xSplit: ENCABEZADOS_FIJOS.length, ySplit: 1 }],
    });

    const encabezados = [
      ...ENCABEZADOS_FIJOS,
      ...columnas.map((p) => `${p.blockLabel} — ${etiquetaPaso(p.step, p.instance)}`),
    ];
    const filaEncabezado = hoja.addRow(encabezados);
    filaEncabezado.height = 60;
    filaEncabezado.eachCell((celda) => {
      celda.font = { bold: true };
      celda.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    });

    hoja.getColumn(1).width = 12;
    hoja.getColumn(2).width = 28;
    hoja.getColumn(3).width = 9;
    hoja.getColumn(4).width = 12;
    hoja.getColumn(5).width = 26;
    hoja.getColumn(6).width = 9;
    for (let i = 0; i < columnas.length; i++) {
      hoja.getColumn(ENCABEZADOS_FIJOS.length + 1 + i).width = 15;
    }

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
        docentesPorAsignatura.get(a.id) ?? '',
        `${avance}%`,
      ]);

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
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          return;
        }

        if (!celda || celda.status === 'vacio') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ESTADOS.vacio.fondo } };
          return;
        }

        const e = ESTADOS[celda.status];
        cell.value = e.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.fondo } };
        cell.font = { color: { argb: e.texto } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        const detalle = [
          celda.done_date ? `Fecha: ${celda.done_date}` : null,
          celda.initials ? `Iniciales: ${celda.initials}` : null,
          celda.comment ? `Comentario: ${celda.comment}` : null,
          celda.second_comment ? `Segundo comentario: ${celda.second_comment}` : null,
        ].filter(Boolean).join('\n');
        if (detalle) {
          cell.note = { texts: [{ text: detalle }] };
        }
      });
    }
  }

  if (!libro.worksheets.length) {
    libro.addWorksheet('Sin datos').addRow(['Todavía no hay programas con asignaturas para exportar.']);
  }

  const nombreArchivo = `matriz-seguimiento-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  await libro.xlsx.write(res);
  res.end();
});
