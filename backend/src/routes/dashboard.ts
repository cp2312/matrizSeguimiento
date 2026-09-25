import { Router } from 'express';
import { query } from '../db/pool.js';
import {
  buildStepPaths, pasosVisibles, pasosAplicables, findStepDef, etiquetaPaso, parseStepPath, PIPELINE_TEMPLATE,
} from '../../../shared/pipelineTemplate.js';
import type { CellStatus, MatrixCell, Program, ProgramType, Subject } from '../../../shared/types.js';

export const dashboardRouter = Router();

const ESTADOS_VACIOS: Record<CellStatus, number> = {
  vacio: 0, pendiente_equipo: 0, pendiente_jefe: 0, ajustes: 0, terminado: 0, por_revisar: 0,
};

/** Cuántos días faltan hasta `fecha` (negativo si ya pasó) -- mismo cálculo
 *  que ya usan dueDateWarnings/contractWarnings/bookWarnings. */
function diasHasta(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${fecha}T00:00:00`);
  return Math.round((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

interface Alerta {
  tipo: 'fecha_limite' | 'contrato' | 'libro';
  etiqueta: string;
  asignatura: string;
  programa: string;
  subjectId: number;
  apartado: string;
  fecha: string;
  diasRestantes: number;
}

/**
 * Fechas límite, contratos y entregas de libro por vencer o ya vencidos --
 * misma ventana de anticipación que usa cada aviso por correo (ver
 * dueDateWarnings/contractWarnings/bookWarnings.ts), pero mostrando el
 * estado actual siempre, no solo la primera vez (esos avisos no se repiten
 * una vez enviados; acá sí interesa verlo mientras siga sin resolverse).
 */
async function cargarAlertas(): Promise<Alerta[]> {
  const hoy = new Date();
  const limiteFechaLimite = new Date(hoy); limiteFechaLimite.setDate(hoy.getDate() + 7);
  const limiteContrato = new Date(hoy); limiteContrato.setDate(hoy.getDate() + 15);
  const limiteLibro = hoy.toISOString().slice(0, 10);

  const fechasLimite = await query<{ subject_id: number; step_path: string; due_date: string; subject_name: string; program_name: string }>(
    `SELECT c.subject_id, c.step_path, c.due_date, s.name AS subject_name, p.name AS program_name
     FROM matrix_cells c
     JOIN subjects s ON s.id = c.subject_id
     JOIN programs p ON p.id = s.program_id
     WHERE c.due_date IS NOT NULL AND c.due_date <= $1 AND c.status <> 'terminado'
       AND NOT s.archived AND NOT p.archived
     ORDER BY c.due_date`,
    [limiteFechaLimite.toISOString().slice(0, 10)]
  );

  const contratos = await query<{ subject_id: number; full_name: string; end_date: string; subject_name: string; program_name: string }>(
    `SELECT t.subject_id, t.full_name, t.end_date, s.name AS subject_name, p.name AS program_name
     FROM subject_teachers t
     JOIN subjects s ON s.id = t.subject_id
     JOIN programs p ON p.id = s.program_id
     WHERE t.end_date IS NOT NULL AND t.end_date <= $1
       AND NOT s.archived AND NOT p.archived
     ORDER BY t.end_date`,
    [limiteContrato.toISOString().slice(0, 10)]
  );

  const libros = await query<{ subject_id: number; book_due_date: string; subject_name: string; program_name: string }>(
    `SELECT s.id AS subject_id, s.book_due_date, s.name AS subject_name, p.name AS program_name
     FROM subjects s
     JOIN programs p ON p.id = s.program_id
     LEFT JOIN matrix_cells c ON c.subject_id = s.id AND c.step_path = 'libro.recepcion_libro'
     WHERE s.book_due_date IS NOT NULL AND s.book_due_date <= $1
       AND (c.status IS NULL OR c.status <> 'terminado')
       AND NOT s.archived AND NOT p.archived
     ORDER BY s.book_due_date`,
    [limiteLibro]
  );

  const alertas: Alerta[] = [];

  for (const f of fechasLimite) {
    const def = findStepDef(f.step_path);
    if (!def) continue;
    const { instance } = parseStepPath(f.step_path);
    alertas.push({
      tipo: 'fecha_limite',
      etiqueta: `${def.block.label} — ${etiquetaPaso(def.step, instance)}`,
      asignatura: f.subject_name,
      programa: f.program_name,
      subjectId: f.subject_id,
      apartado: f.step_path.split('.').slice(0, -1).join('.'),
      fecha: f.due_date,
      diasRestantes: diasHasta(f.due_date),
    });
  }

  for (const c of contratos) {
    alertas.push({
      tipo: 'contrato',
      etiqueta: c.full_name,
      asignatura: c.subject_name,
      programa: c.program_name,
      subjectId: c.subject_id,
      apartado: 'contrato',
      fecha: c.end_date,
      diasRestantes: diasHasta(c.end_date),
    });
  }

  for (const l of libros) {
    alertas.push({
      tipo: 'libro',
      etiqueta: 'Entrega del libro',
      asignatura: l.subject_name,
      programa: l.program_name,
      subjectId: l.subject_id,
      apartado: 'libro',
      fecha: l.book_due_date,
      diasRestantes: diasHasta(l.book_due_date),
    });
  }

  return alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/**
 * Resumen de toda la aplicación: avance global, desglosado por estado, por
 * apartado del proceso y por programa -- para el Dashboard. Recorre las
 * mismas reglas que el tablero de un programa (pasosVisibles/pasosAplicables,
 * ver shared/pipelineTemplate.ts) pero para TODOS los programas activos a la
 * vez, en vez de uno solo.
 */
dashboardRouter.get('/dashboard', async (_req, res) => {
  const programas = await query<Program>(`SELECT * FROM programs WHERE NOT archived ORDER BY name`);
  const programIds = programas.map((p) => p.id);

  const asignaturas = await query<Subject>(
    `SELECT * FROM subjects WHERE program_id = ANY($1::int[]) AND NOT archived ORDER BY program_id, semester, name`,
    [programIds]
  );
  const subjectIds = asignaturas.map((a) => a.id);

  const celdas = await query<MatrixCell>(
    `SELECT * FROM matrix_cells WHERE subject_id = ANY($1::int[])`,
    [subjectIds]
  );
  const celdasPorAsignatura = new Map<number, Record<string, MatrixCell>>();
  for (const c of celdas) {
    const mapa = celdasPorAsignatura.get(c.subject_id) ?? {};
    mapa[c.step_path] = c;
    celdasPorAsignatura.set(c.subject_id, mapa);
  }

  const quitadasFilas = await query<{ subject_id: number; block_key: string; instance: number }>(
    `SELECT subject_id, block_key, instance FROM subject_removed_instances WHERE subject_id = ANY($1::int[])`,
    [subjectIds]
  );
  const quitadasPorAsignatura = new Map<number, Set<string>>();
  for (const f of quitadasFilas) {
    const set = quitadasPorAsignatura.get(f.subject_id) ?? new Set<string>();
    set.add(`${f.block_key}.${f.instance}`);
    quitadasPorAsignatura.set(f.subject_id, set);
  }

  const [{ count: docentesCount }] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM subject_teachers WHERE subject_id = ANY($1::int[])`,
    [subjectIds]
  );

  const alertas = await cargarAlertas();

  // Pasos que pasaron a "terminado" por semana, últimas 8 semanas (incluye
  // semanas sin ninguno, para que el gráfico no quede con huecos). No filtra
  // por asignatura activa -- el trabajo ya hecho cuenta igual aunque después
  // se haya archivado.
  const tendenciaSemanal = await query<{ semana: string; terminados: string }>(
    `WITH semanas AS (
       SELECT generate_series(
         date_trunc('week', now() - interval '7 weeks'),
         date_trunc('week', now()),
         interval '1 week'
       )::date AS semana
     )
     SELECT s.semana::text, COUNT(h.id)::text AS terminados
     FROM semanas s
     LEFT JOIN cell_history h
       ON date_trunc('week', h.changed_at)::date = s.semana AND h.new_status = 'terminado'
     GROUP BY s.semana
     ORDER BY s.semana`
  );

  const programaPorId = new Map(programas.map((p) => [p.id, p]));

  const porEstado: Record<CellStatus, number> = { ...ESTADOS_VACIOS };
  const porApartadoMap = new Map<string, { terminados: number; total: number }>();
  const porProgramaMap = new Map<number, { terminados: number; total: number; asignaturas: number }>();
  const porAsignaturaLista: { id: number; name: string; programId: number; terminados: number; total: number }[] = [];
  let terminadosGlobal = 0;
  let totalGlobal = 0;

  for (const a of asignaturas) {
    const celdasDeAsignatura = celdasPorAsignatura.get(a.id) ?? {};
    const quitadas = quitadasPorAsignatura.get(a.id) ?? new Set<string>();
    const pasos = pasosVisibles(
      pasosAplicables(buildStepPaths(a.credits), celdasDeAsignatura, quitadas), celdasDeAsignatura
    );

    let terminadosAsignatura = 0;
    for (const p of pasos) {
      const status = celdasDeAsignatura[p.path]?.status ?? 'vacio';
      porEstado[status]++;
      if (status === 'terminado') terminadosAsignatura++;

      const apartado = porApartadoMap.get(p.blockKey) ?? { terminados: 0, total: 0 };
      apartado.total++;
      if (status === 'terminado') apartado.terminados++;
      porApartadoMap.set(p.blockKey, apartado);
    }

    terminadosGlobal += terminadosAsignatura;
    totalGlobal += pasos.length;

    porAsignaturaLista.push({
      id: a.id, name: a.name, programId: a.program_id, terminados: terminadosAsignatura, total: pasos.length,
    });

    const prog = porProgramaMap.get(a.program_id) ?? { terminados: 0, total: 0, asignaturas: 0 };
    prog.terminados += terminadosAsignatura;
    prog.total += pasos.length;
    prog.asignaturas += 1;
    porProgramaMap.set(a.program_id, prog);
  }

  const porTipo: Record<ProgramType, number> = { hibrido: 0, presencial: 0, virtual: 0 };
  for (const p of programas) porTipo[p.type]++;

  const porApartado = PIPELINE_TEMPLATE
    .map((b) => {
      const agg = porApartadoMap.get(b.key) ?? { terminados: 0, total: 0 };
      return {
        blockKey: b.key,
        label: b.label,
        terminados: agg.terminados,
        total: agg.total,
        porcentaje: agg.total ? Math.round((agg.terminados / agg.total) * 100) : 0,
      };
    })
    .filter((b) => b.total > 0)
    .sort((a, b) => a.porcentaje - b.porcentaje);

  const porPrograma = programas
    .map((p) => {
      const agg = porProgramaMap.get(p.id) ?? { terminados: 0, total: 0, asignaturas: 0 };
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        asignaturas: agg.asignaturas,
        terminados: agg.terminados,
        total: agg.total,
        porcentaje: agg.total ? Math.round((agg.terminados / agg.total) * 100) : 0,
      };
    })
    .sort((a, b) => a.porcentaje - b.porcentaje);

  const TOPE_ASIGNATURAS_ATRASADAS = 10;
  const asignaturasMasAtrasadas = porAsignaturaLista
    .map((a) => ({
      id: a.id,
      name: a.name,
      programId: a.programId,
      programName: programaPorId.get(a.programId)?.name ?? '',
      terminados: a.terminados,
      total: a.total,
      porcentaje: a.total ? Math.round((a.terminados / a.total) * 100) : 0,
    }))
    .sort((a, b) => a.porcentaje - b.porcentaje)
    .slice(0, TOPE_ASIGNATURAS_ATRASADAS);

  res.json({
    generadoEn: new Date().toISOString(),
    programas: { total: programas.length, porTipo },
    asignaturas: { total: asignaturas.length },
    docentes: { total: Number(docentesCount ?? 0) },
    bloqueados: quitadasFilas.length,
    avanceGlobal: {
      terminados: terminadosGlobal,
      total: totalGlobal,
      porcentaje: totalGlobal ? Math.round((terminadosGlobal / totalGlobal) * 100) : 0,
    },
    porEstado,
    porApartado,
    porPrograma,
    asignaturasMasAtrasadas,
    tendenciaSemanal: tendenciaSemanal.map((f) => ({ semana: f.semana, terminados: Number(f.terminados) })),
    alertas,
  });
});
