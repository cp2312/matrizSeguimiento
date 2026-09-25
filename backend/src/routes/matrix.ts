import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { enviarAvisoPendiente } from '../lib/mailer.js';
import { obtenerEncargado } from '../lib/encargados.js';
import { revisarSiSeCompleto } from '../lib/completionEmail.js';
import { cargarQuitadas, cargarQuitadasPorPrograma } from '../lib/removedInstances.js';
import {
  buildStepPaths, isValidStepPath, findStepDef, totalSteps, pasosVisibles, parseStepPath, etiquetaPaso,
  pasosAplicables, pasoQueFalta, computeRepeatCount, bloqueCompletamenteQuitado, esPasoPropagable,
  pasoPideFechaLimite, PIPELINE_TEMPLATE,
} from '../../../shared/pipelineTemplate.js';
import { sumarDiasHabiles, hoyISO } from '../../../shared/businessDays.js';
import type { BlockDef, MatrixCell, StepDef, Subject, SubjectTeacher } from '../../../shared/types.js';

/**
 * "Pendiente jefe" avisa siempre a la jefe (categoría especial "jefe"), sin
 * importar en qué apartado haya pasado -- ese estado ya significa "necesita
 * a la jefe" en cualquier parte de la asignatura. Un paso que solo queda "En
 * proceso" (pendiente_equipo) NO avisa por correo -- esos avisos son por
 * fecha límite (ver dueDateWarnings.ts) o fecha de contrato/entrega (ver
 * contractWarnings.ts / bookWarnings.ts), no por el simple cambio de estado.
 * Solo avisa si el estado ACABA de pasar a "Pendiente jefe" (no si ya lo
 * estaba). Nunca lanza: un correo que falla no debe tumbar el guardado.
 */
async function avisarSiQuedaPendiente(
  blockLabel: string, estadoAnterior: string | undefined,
  celda: MatrixCell, asignaturaNombre: string, pasoLabel: string
): Promise<void> {
  if (celda.status !== 'pendiente_jefe') return;
  if (celda.status === estadoAnterior) return;

  try {
    const encargado = await obtenerEncargado('jefe', celda.subject_id);
    if (!encargado) return;

    // El "apartado" que abre el link es el step_path sin el último tramo:
    // "guias.1.recepcion_experto" -> "guias.1"; "contrato.tipo_contrato" -> "contrato"
    const apartado = celda.step_path.split('.').slice(0, -1).join('.');

    await enviarAvisoPendiente({
      paraEmail: encargado.email,
      paraNombre: encargado.full_name,
      asignatura: asignaturaNombre,
      categoria: blockLabel,
      paso: pasoLabel,
      estado: celda.status,
      subjectId: celda.subject_id,
      apartado,
    });
  } catch (err) {
    console.error('[matrix] Error al avisar por correo:', err);
  }
}

/**
 * Copia un paso recién marcado como terminado a las demás instancias del
 * mismo bloque repetible que todavía lo tengan vacío (ver
 * shared/pipelineTemplate.ts esPasoPropagable) -- p. ej. al terminar
 * "Creación de guión" de OVA 1, se completa solo en OVA 2, OVA 3... para no
 * tener que repetir el mismo dato instancia por instancia en los pasos que
 * casi siempre se resuelven todos juntos. Nunca pisa una instancia que ya
 * tiene ese paso tocado a mano, ni crea instancias extra que no existían.
 * No lanza: si falla, no debe tumbar el guardado que sí se pidió.
 */
async function propagarATodasLasInstancias(
  io: SocketIOServer, subjectId: string, credits: number,
  block: BlockDef, step: StepDef, instanceOrigen: number,
  celdaOrigen: MatrixCell, quitadas: ReadonlySet<string>
): Promise<void> {
  if (celdaOrigen.status !== 'terminado') return;
  if (!esPasoPropagable(block, step)) return;

  try {
    const garantizadas = computeRepeatCount(block, credits);
    const tope = block.repeatable!.extensible ? block.repeatable!.max : garantizadas;
    if (tope <= 1) return;

    const celdasDelBloque = await query<MatrixCell>(
      `SELECT * FROM matrix_cells WHERE subject_id = $1 AND step_path LIKE $2`,
      [subjectId, `${block.key}.%`]
    );
    const porPath = new Map(celdasDelBloque.map((c) => [c.step_path, c]));
    const instanciasConDatos = new Set(celdasDelBloque.map((c) => Number(c.step_path.split('.')[1])));

    for (let otraInstancia = 1; otraInstancia <= tope; otraInstancia++) {
      if (otraInstancia === instanceOrigen) continue;

      if (otraInstancia <= garantizadas) {
        if (quitadas.has(`${block.key}.${otraInstancia}`)) continue;
      } else if (!instanciasConDatos.has(otraInstancia)) {
        continue; // no crear de la nada una instancia extra que nadie agregó
      }

      const targetPath = `${block.key}.${otraInstancia}.${step.key}`;
      const actual = porPath.get(targetPath);
      if (actual && actual.status !== 'vacio') continue; // no pisar lo que ya se tocó a mano

      const propagada = await queryOne<MatrixCell>(
        `INSERT INTO matrix_cells
           (subject_id, step_path, status, done_date, initials, comment, second_comment, due_date, reference_date, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (subject_id, step_path)
         DO UPDATE SET
           status         = EXCLUDED.status,
           done_date      = EXCLUDED.done_date,
           initials       = EXCLUDED.initials,
           comment        = EXCLUDED.comment,
           second_comment = EXCLUDED.second_comment,
           due_date       = EXCLUDED.due_date,
           reference_date = EXCLUDED.reference_date,
           due_date_warning_sent_at =
             CASE WHEN matrix_cells.due_date IS DISTINCT FROM EXCLUDED.due_date
                  THEN NULL ELSE matrix_cells.due_date_warning_sent_at END,
           version        = matrix_cells.version + 1,
           updated_by     = EXCLUDED.updated_by
         RETURNING *`,
        [
          subjectId, targetPath, celdaOrigen.status,
          celdaOrigen.done_date, celdaOrigen.initials,
          celdaOrigen.comment, celdaOrigen.second_comment,
          celdaOrigen.due_date, celdaOrigen.reference_date,
          celdaOrigen.updated_by,
        ]
      );

      if (propagada) io.to(`subject:${subjectId}`).emit('cell:updated', propagada);
    }
  } catch (err) {
    console.error('[matrix] Error propagando paso a las demás instancias:', err);
  }
}

export function buildMatrixRouter(io: SocketIOServer) {
  const router = Router();

  // Traer la matriz completa de una asignatura
  router.get('/subjects/:id/matrix', async (req, res) => {
    const asignatura = await queryOne<Subject>(
      'SELECT * FROM subjects WHERE id = $1', [req.params.id]
    );
    if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

    // El pipeline dice qué pasos le corresponden según sus créditos
    const pasos = buildStepPaths(asignatura.credits);

    // La base dice cuáles ya se tocaron
    const filas = await query<MatrixCell>(
      'SELECT * FROM matrix_cells WHERE subject_id = $1', [req.params.id]
    );
    const teachers = await query<SubjectTeacher>(
      'SELECT * FROM subject_teachers WHERE subject_id = $1 ORDER BY id', [req.params.id]
    );

    const celdas: Record<string, MatrixCell> = {};
    for (const fila of filas) celdas[fila.step_path] = fila;

    const quitadas = await cargarQuitadas(req.params.id);

    // Los pasos condicionales que ya se descartaron (p. ej. "No hay ajustes") no
    // cuentan para el avance -- si no, nunca se llega al 100% aunque esté todo hecho.
    // Tampoco cuentan las instancias extra de un bloque extensible (p. ej. un
    // segundo "Video de contenido") mientras no se hayan agregado a mano, ni las
    // instancias garantizadas que el equipo quitó a mano (ver "quitadas").
    const visibles = pasosVisibles(pasosAplicables(pasos, celdas, quitadas), celdas);
    const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;

    res.json({
      asignatura: { ...asignatura, teachers },
      pasos,
      celdas,
      quitadas: [...quitadas],
      avance: {
        terminados,
        total: visibles.length,
        porcentaje: Math.round((terminados / visibles.length) * 100),
      },
    });
  });

  // Guardar o actualizar una celda
router.patch('/subjects/:subjectId/matrix/*stepPath', async (req, res) => {
  const { subjectId } = req.params;
  // En Express 5 un comodin "*nombre" llega como array de segmentos, no como string
  const stepPathParam = (req.params as any).stepPath;
  const stepPath = Array.isArray(stepPathParam) ? stepPathParam.join('/') : stepPathParam;

    const asignatura = await queryOne<Subject>(
      'SELECT * FROM subjects WHERE id = $1', [subjectId]
    );
    if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

    // El pipeline valida que el paso exista y la instancia esté en rango
    if (!isValidStepPath(stepPath, asignatura.credits)) {
      return res.status(400).json({ error: `El paso "${stepPath}" no aplica a esta asignatura` });
    }

    // No se puede guardar un paso de una instancia que el equipo quitó a mano
    // (ver DELETE /instances más abajo) -- hay que agregarla de nuevo primero.
    const quitadas = await cargarQuitadas(subjectId);
    {
      const { blockKey: bk, instance: inst } = parseStepPath(stepPath);
      if (inst !== null && quitadas.has(`${bk}.${inst}`)) {
        return res.status(400).json({ error: 'Esta instancia fue quitada -- agrégala de nuevo primero' });
      }
    }

    const def = findStepDef(stepPath)!;
    const { status, doneDate, comment, secondComment, branchValue, dueDate, referenceDate, assignedNote, version } = req.body;

    // Pasos con StepDef.autoDueDate (p. ej. "Envío para ajustes de experto"):
    // la fecha límite no la escribe el cliente, sale sola de referenceDate +
    // los días hábiles que indique el paso -- así no hay forma de que el
    // cliente mande una fecha límite que no corresponda a la fecha de envío.
    const fechaLimiteCalculada = def.step.autoDueDate && referenceDate
      ? sumarDiasHabiles(referenceDate, def.step.autoDueDate.businessDays)
      : null;

    // Comentario obligatorio
    if (def.step.commentRequired && status === 'terminado' && !comment?.trim()) {
      return res.status(400).json({
        error: `"${def.step.label}" requiere ${def.step.commentLabel ?? 'un comentario'}`,
      });
    }

    // Segundo comentario obligatorio (p. ej. porcentaje de IA)
    if (def.step.secondCommentRequired && status === 'terminado' && !secondComment?.trim()) {
      return res.status(400).json({
        error: `"${def.step.label}" requiere ${def.step.secondCommentLabel ?? 'un segundo comentario'}`,
      });
    }

    // Solo los pasos de decisión aceptan branchValue
    if (branchValue !== undefined && branchValue !== null && !def.step.isBranchPoint) {
      return res.status(400).json({ error: `"${def.step.label}" no es un paso de decisión` });
    }

    // La fecha límite se escribe a mano solo cuando NO es autoDueDate (esa se
    // calcula sola a partir de referenceDate, que sí puede quedar en el
    // pasado -- p. ej. "enviado al experto el..." registrado después).
    if (!def.step.autoDueDate && pasoPideFechaLimite(def.step, asignatura.videos_por_docente) && dueDate && dueDate < hoyISO()) {
      return res.status(400).json({
        error: `${def.step.dueDateLabel ?? 'La fecha límite'} no puede ser anterior a hoy`,
      });
    }

    // No se puede avanzar un paso (sacarlo de "vacío") si el paso anterior de su
    // mismo apartado todavía no está terminado -- pero sí se puede vaciarlo de
    // vuelta en cualquier momento, para poder deshacer.
    if (status && status !== 'vacio') {
      const celdasAsignatura = await query<MatrixCell>(
        'SELECT * FROM matrix_cells WHERE subject_id = $1', [subjectId]
      );
      const celdasMap: Record<string, MatrixCell> = {};
      for (const c of celdasAsignatura) celdasMap[c.step_path] = c;

      const { blockKey, instance } = parseStepPath(stepPath);
      const pasosDelApartado = pasosVisibles(
        pasosAplicables(buildStepPaths(asignatura.credits), celdasMap, quitadas), celdasMap
      ).filter((p) => p.blockKey === blockKey && p.instance === instance);

      const faltante = pasoQueFalta(pasosDelApartado, stepPath, celdasMap);
      if (faltante) {
        return res.status(400).json({
          error: `Completa primero "${etiquetaPaso(faltante.step, faltante.instance)}"`,
        });
      }
    }

    // Las iniciales salen del usuario, no del cliente
    const usuario = (req as any).user ?? { id: null, initials: null };

    // Para saber si el estado recién ENTRA a pendiente (y no si ya lo estaba)
    const celdaPrevia = await queryOne<{ status: string }>(
      'SELECT status FROM matrix_cells WHERE subject_id = $1 AND step_path = $2',
      [subjectId, stepPath]
    );

    // Optimistic locking: si el cliente envía una versión, verificar que coincida
    if (version !== undefined && version !== null) {
      const actual = await queryOne<{ version: number }>(
        'SELECT version FROM matrix_cells WHERE subject_id = $1 AND step_path = $2',
        [subjectId, stepPath]
      );
      if (actual && actual.version !== version) {
        return res.status(409).json({
          error: 'Otro usuario modificó esta celda. Recarga para ver los cambios actuales.',
          currentVersion: actual.version,
        });
      }
    }

    try {
      const celda = await queryOne<MatrixCell>(
        `INSERT INTO matrix_cells
           (subject_id, step_path, status, done_date, initials, comment, second_comment, branch_value, due_date, reference_date, assigned_note, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (subject_id, step_path)
         DO UPDATE SET
           status         = EXCLUDED.status,
           done_date      = EXCLUDED.done_date,
           initials       = EXCLUDED.initials,
           comment        = EXCLUDED.comment,
           second_comment = EXCLUDED.second_comment,
           branch_value   = EXCLUDED.branch_value,
           due_date       = EXCLUDED.due_date,
           reference_date = EXCLUDED.reference_date,
           assigned_note  = EXCLUDED.assigned_note,
           -- Si la fecha límite cambió, se rehabilita el aviso de "por
           -- vencer" para la nueva fecha (si no, correrla hacia adelante
           -- nunca volvería a avisar). Aplica igual si cambió porque
           -- cambió la fecha de envío de un paso con autoDueDate.
           due_date_warning_sent_at =
             CASE WHEN matrix_cells.due_date IS DISTINCT FROM EXCLUDED.due_date
                  THEN NULL ELSE matrix_cells.due_date_warning_sent_at END,
           version        = matrix_cells.version + 1,
           updated_by     = EXCLUDED.updated_by
         RETURNING *`,
        [
          subjectId, stepPath, status ?? 'vacio',
          doneDate ?? null, usuario.initials,
          comment ?? null, secondComment ?? null,
          def.step.isBranchPoint ? branchValue ?? null : null,
          def.step.autoDueDate
            ? fechaLimiteCalculada
            : (pasoPideFechaLimite(def.step, asignatura.videos_por_docente) ? dueDate ?? null : null),
          def.step.autoDueDate ? referenceDate ?? null : null,
          status === 'pendiente_equipo' ? assignedNote ?? null : null,
          usuario.id,
        ]
      );

      if (!celda) throw new Error('El INSERT ... RETURNING no devolvió fila');

      // Tiempo real: todos los que vean esta asignatura reciben el cambio
      io.to(`subject:${subjectId}`).emit('cell:updated', celda);

      // Aviso por correo: no se espera a que termine para responder al cliente
      const { instance } = parseStepPath(stepPath);
      void avisarSiQuedaPendiente(
        def.block.label, celdaPrevia?.status, celda, asignatura.name, etiquetaPaso(def.step, instance)
      );

      // Un paso de los "de siempre igual" (antes de la revisión final/ajustes,
      // ver esPasoPropagable) se completa solo en las demás instancias del
      // mismo bloque que todavía lo tengan vacío -- se espera a que termine
      // antes de revisar si la asignatura quedó completa, para que esa
      // revisión ya vea el estado final.
      if (instance !== null) {
        await propagarATodasLasInstancias(
          io, subjectId, asignatura.credits, def.block, def.step, instance, celda, quitadas
        );
      }
      void revisarSiSeCompleto(celda.subject_id);

      res.json(celda);
    } catch (err: any) {
      if (err.code === '23514') {
        return res.status(400).json({
          error: 'Para marcar como terminado hay que registrar la fecha',
        });
      }
      throw err;
    }
  });

  // Quitar una instancia de un bloque repetible (p. ej. "OVA 1" que al final
  // no se hizo, o un "Video de contenido 3" agregado a mano que no hizo
  // falta) -- borra todas sus celdas y, si es una instancia GARANTIZADA por
  // créditos (no una extra), además la marca en subject_removed_instances
  // para que deje de contar en el avance (ver excluirInstanciasQuitadas). Una
  // instancia extra no necesita esa marca: en cuanto pierde sus celdas
  // vuelve a quedar oculta sola (ver excluirInstanciasExtraSinUsar).
  router.delete('/subjects/:subjectId/instances/:blockKey/:instance', async (req, res) => {
    const { subjectId, blockKey, instance: instanceParam } = req.params;

    const asignatura = await queryOne<Subject>('SELECT * FROM subjects WHERE id = $1', [subjectId]);
    if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

    const block = PIPELINE_TEMPLATE.find((b) => b.key === blockKey);
    if (!block?.repeatable) {
      return res.status(400).json({ error: `"${blockKey}" no admite instancias` });
    }

    const instance = Number(instanceParam);
    const garantizadas = computeRepeatCount(block, asignatura.credits);
    const tope = block.repeatable.extensible ? block.repeatable.max : garantizadas;
    if (!Number.isInteger(instance) || instance < 1 || instance > tope) {
      return res.status(400).json({ error: 'Esa instancia no existe en este bloque' });
    }

    const usuario = (req as any).user ?? { id: null };

    await query(
      `DELETE FROM matrix_cells WHERE subject_id = $1 AND step_path LIKE $2`,
      [subjectId, `${blockKey}.${instance}.%`]
    );

    if (instance <= garantizadas) {
      await query(
        `INSERT INTO subject_removed_instances (subject_id, block_key, instance, removed_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (subject_id, block_key, instance) DO NOTHING`,
        [subjectId, blockKey, instance, usuario.id]
      );
    }

    void revisarSiSeCompleto(Number(subjectId));

    res.status(204).send();
  });

  // Volver a agregar una instancia garantizada que se había quitado (ver
  // DELETE de arriba) -- no aplica a instancias extra, esas se agregan de
  // nuevo solo con guardar cualquier paso suyo.
  router.post('/subjects/:subjectId/instances/:blockKey/:instance/restaurar', async (req, res) => {
    const { subjectId, blockKey, instance } = req.params;

    await query(
      `DELETE FROM subject_removed_instances WHERE subject_id = $1 AND block_key = $2 AND instance = $3`,
      [subjectId, blockKey, Number(instance)]
    );

    res.status(204).send();
  });

  // Bloquear un apartado repetible COMPLETO para esta asignatura (p. ej. "acá
  // no se usa Infografía") -- quita de una todas sus instancias garantizadas
  // por créditos, con el mismo mecanismo que el DELETE de instancia suelta de
  // arriba. Las instancias extra de un bloque extensible no se tocan acá; si
  // hay alguna en uso, se quita aparte con su propio ícono.
  router.post('/subjects/:subjectId/blocks/:blockKey/bloquear', async (req, res) => {
    const { subjectId, blockKey } = req.params;

    const asignatura = await queryOne<Subject>('SELECT * FROM subjects WHERE id = $1', [subjectId]);
    if (!asignatura) return res.status(404).json({ error: 'Asignatura no encontrada' });

    const block = PIPELINE_TEMPLATE.find((b) => b.key === blockKey);
    if (!block?.repeatable) {
      return res.status(400).json({ error: `"${blockKey}" no se puede bloquear` });
    }

    const garantizadas = computeRepeatCount(block, asignatura.credits);
    const usuario = (req as any).user ?? { id: null };

    await withTransaction(async (client) => {
      for (let instance = 1; instance <= garantizadas; instance++) {
        await client.query(
          `DELETE FROM matrix_cells WHERE subject_id = $1 AND step_path LIKE $2`,
          [subjectId, `${blockKey}.${instance}.%`]
        );
        await client.query(
          `INSERT INTO subject_removed_instances (subject_id, block_key, instance, removed_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (subject_id, block_key, instance) DO NOTHING`,
          [subjectId, blockKey, instance, usuario.id]
        );
      }
    });

    void revisarSiSeCompleto(Number(subjectId));

    res.status(204).send();
  });

  // Desbloquear un apartado repetible completo (ver bloquear de arriba) --
  // saca todas sus marcas de "quitada", garantizadas o no, así que también
  // deshace instancias quitadas una por una con el DELETE de instancia suelta.
  router.post('/subjects/:subjectId/blocks/:blockKey/desbloquear', async (req, res) => {
    const { subjectId, blockKey } = req.params;

    await query(
      `DELETE FROM subject_removed_instances WHERE subject_id = $1 AND block_key = $2`,
      [subjectId, blockKey]
    );

    res.status(204).send();
  });

  // Historial de una asignatura
  router.get('/subjects/:id/historial', async (req, res) => {
    const historial = await query(
      `SELECT h.step_path, h.old_status, h.new_status, h.changed_at, u.full_name, u.initials
       FROM cell_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.subject_id = $1
       ORDER BY h.changed_at DESC
       LIMIT 100`,
      [req.params.id]
    );

    res.json(historial);
  });
// Tablero del programa: cada asignatura con el estado resumido de cada bloque
router.get('/programs/:id/tablero', async (req, res) => {
  const asignaturas = await query<Subject>(
    `SELECT * FROM subjects
     WHERE program_id = $1 AND NOT archived
     ORDER BY semester, name`,
    [req.params.id]
  );

  if (!asignaturas.length) return res.json([]);

  const celdas = await query<MatrixCell>(
    `SELECT c.* FROM matrix_cells c
     JOIN subjects s ON s.id = c.subject_id
     WHERE s.program_id = $1`,
    [req.params.id]
  );

  const docentes = await query<SubjectTeacher>(
    `SELECT t.* FROM subject_teachers t
     JOIN subjects s ON s.id = t.subject_id
     WHERE s.program_id = $1 AND NOT s.archived
     ORDER BY t.id`,
    [req.params.id]
  );
  const docentesPorAsignatura = new Map<number, SubjectTeacher[]>();
  for (const d of docentes) {
    const lista = docentesPorAsignatura.get(d.subject_id) ?? [];
    lista.push(d);
    docentesPorAsignatura.set(d.subject_id, lista);
  }

  const quitadasPorAsignatura = await cargarQuitadasPorPrograma(req.params.id);

  // Agrupa las celdas por asignatura, indexadas por step_path (para poder
  // resolver branch_value igual que en la matriz de una asignatura)
  const celdasPorAsignatura = new Map<number, Record<string, MatrixCell>>();
  for (const celda of celdas) {
    const mapa = celdasPorAsignatura.get(celda.subject_id) ?? {};
    mapa[celda.step_path] = celda;
    celdasPorAsignatura.set(celda.subject_id, mapa);
  }

  const resultado = asignaturas.map((a) => {
    const celdasDeAsignatura = celdasPorAsignatura.get(a.id) ?? {};
    const quitadas = quitadasPorAsignatura.get(a.id) ?? new Set<string>();

    // Los pasos condicionales ya descartados (p. ej. "No hay ajustes") ni cuentan
    // ni pintan de blanco un bloque que en realidad ya está completo del todo.
    // Tampoco cuentan las instancias extra de un bloque extensible mientras no
    // se hayan agregado a mano -- si no, un "Video de contenido" ya terminado
    // se pintaría como "En proceso" solo por los cupos extra sin tocar. Ni las
    // instancias garantizadas que el equipo quitó a mano (ver "quitadas").
    const pasos = pasosVisibles(pasosAplicables(buildStepPaths(a.credits), celdasDeAsignatura, quitadas), celdasDeAsignatura);

    const estados: Record<string, string[]> = {};
    for (const p of pasos) {
      (estados[p.blockKey] ??= []).push(celdasDeAsignatura[p.path]?.status ?? 'vacio');
    }

    const terminados = pasos.filter((p) => celdasDeAsignatura[p.path]?.status === 'terminado').length;

    // Apartados que el equipo bloqueó del todo para esta asignatura (ver
    // POST .../blocks/:blockKey/bloquear) -- para pintarlos distinto de "Sin
    // iniciar" en el tablero, en vez de que se vean iguales.
    const bloqueados = PIPELINE_TEMPLATE
      .filter((b) => bloqueCompletamenteQuitado(b, a.credits, quitadas))
      .map((b) => b.key);

    return {
      ...a,
      teachers: docentesPorAsignatura.get(a.id) ?? [],
      estadosPorBloque: estados,
      bloqueados,
      avance: Math.round((terminados / pasos.length) * 100),
    };
  });

  res.json(resultado);
});
  
  return router;

  
}