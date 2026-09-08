import { useState } from 'react';
import { api } from '../lib/api';
import { BotonConfirmar } from './ui/BotonConfirmar';
import { Alerta } from './ui/Alerta';
import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados';
import { etiquetaPaso } from '../lib/bloques';
import { sumarDiasHabiles } from '@shared/businessDays';
import type { CellStatus, MatrixCell, ResolvedStep, SubjectTeacher } from '@shared/types';

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA', sin pasar por Date (evita corrimientos de zona horaria) */
function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

interface Props {
  subjectId: number;
  paso: ResolvedStep;
  celda?: MatrixCell;
  teachers: SubjectTeacher[];
  onGuardado: (celda: MatrixCell) => void;
  onTeachersChanged: (teachers: SubjectTeacher[]) => void;
  onCerrar: () => void;
  onRecargar?: () => void;
}

const HOY = new Date().toISOString().slice(0, 10);

type EdicionContrato = { start_date: string; end_date: string; contract_type: string };

function aEdicion(t: SubjectTeacher): EdicionContrato {
  return { start_date: t.start_date ?? '', end_date: t.end_date ?? '', contract_type: t.contract_type ?? '' };
}

/** Aquí (y no al crear la asignatura) se sabe de verdad el tipo de contrato de cada
 *  docente ya asignado -- quién está asignado se maneja en su propia sección.
 *
 *  Los campos ya no se guardan solos al salir de cada uno: se acumulan en
 *  `ediciones` y solo se envían al confirmar "Guardar", para que un dato a
 *  medio escribir no quede guardado por accidente. "Deshacer" descarta lo
 *  tecleado y vuelve a lo que ya estaba guardado. */
function DocentesContrato({ subjectId, teachers, onCambiados, onCeldaActualizada }: {
  subjectId: number;
  teachers: SubjectTeacher[];
  onCambiados: (teachers: SubjectTeacher[]) => void;
  onCeldaActualizada: (celda: MatrixCell) => void;
}) {
  const [ediciones, setEdiciones] = useState<Record<number, EdicionContrato>>({});

  function valor(t: SubjectTeacher, campo: keyof EdicionContrato): string {
    return ediciones[t.id]?.[campo] ?? aEdicion(t)[campo];
  }

  function setCampo(t: SubjectTeacher, campo: keyof EdicionContrato, valorNuevo: string) {
    setEdiciones((prev) => ({
      ...prev,
      [t.id]: { ...(prev[t.id] ?? aEdicion(t)), [campo]: valorNuevo },
    }));
  }

  function hayCambios(t: SubjectTeacher): boolean {
    const e = ediciones[t.id];
    if (!e) return false;
    const original = aEdicion(t);
    return e.start_date !== original.start_date || e.end_date !== original.end_date || e.contract_type !== original.contract_type;
  }

  function deshacer(t: SubjectTeacher) {
    setEdiciones((prev) => {
      const { [t.id]: _quitado, ...resto } = prev;
      return resto;
    });
  }

  async function guardar(t: SubjectTeacher) {
    const e = ediciones[t.id];
    if (!e) return;

    const nuevaLista = teachers.map((x) => ({
      id: x.id,
      fullName: x.full_name,
      startDate: (x.id === t.id ? e.start_date : x.start_date) || null,
      endDate: (x.id === t.id ? e.end_date : x.end_date) || null,
      contractType: (x.id === t.id ? e.contract_type : x.contract_type) || null,
    }));

    const resultado = await api.patch<{ teachers: SubjectTeacher[]; contratoCelda: MatrixCell | null }>(
      `/subjects/${subjectId}`, { teachers: nuevaLista }
    );
    onCambiados(resultado.teachers);
    // Si esto era lo que faltaba para completar el tipo de contrato, el backend
    // ya marcó ese paso como terminado -- se refleja al instante, sin recargar.
    if (resultado.contratoCelda) onCeldaActualizada(resultado.contratoCelda);
    deshacer(t);
  }

  if (teachers.length === 0) {
    return (
      <p className="text-[11px] text-slate-400 mb-3">
        Esta asignatura todavía no tiene docentes asignados (ver "Docentes asignados" en la página).
      </p>
    );
  }

  return (
    <div className="space-y-2 mb-3">
      {teachers.map((t) => (
        <div key={t.id} className="bg-slate-50 rounded-md px-2.5 py-2 space-y-1.5">
          <p className="text-[12px] font-medium text-slate-800">{t.full_name}</p>
          <div className="flex gap-1.5">
            <label className="flex-1 block">
              <span className="block text-[10px] text-slate-400 mb-0.5">Fecha inicio</span>
              <input
                type="date"
                value={valor(t, 'start_date')}
                onChange={(e) => setCampo(t, 'start_date', e.target.value)}
                className="w-full h-7 px-1.5 rounded border border-slate-300 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>
            <label className="flex-1 block">
              <span className="block text-[10px] text-slate-400 mb-0.5">Fecha fin</span>
              <input
                type="date"
                value={valor(t, 'end_date')}
                onChange={(e) => setCampo(t, 'end_date', e.target.value)}
                className="w-full h-7 px-1.5 rounded border border-slate-300 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>
          </div>
          <input
            value={valor(t, 'contract_type')}
            placeholder="Tipo de contrato"
            onChange={(e) => setCampo(t, 'contract_type', e.target.value)}
            className="w-full h-7 px-1.5 rounded border border-slate-300 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
          />

          {hayCambios(t) && (
            <div className="flex items-center justify-end gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => deshacer(t)}
                className="text-[11px] text-slate-500 hover:text-slate-800"
              >
                Deshacer
              </button>
              <BotonConfirmar
                etiqueta="Guardar"
                etiquetaConfirmar="Sí, guardar"
                titulo="Confirmar datos de contrato"
                mensaje={`¿Guardar los datos de contrato de ${t.full_name}?`}
                onConfirmar={() => guardar(t)}
                className="h-6 px-2 text-[11px]"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function PanelCelda({ subjectId, paso, celda, teachers, onGuardado, onTeachersChanged, onCerrar, onRecargar }: Props) {
  const { step, path } = paso;
  const esTipoContrato = path === 'contrato.tipo_contrato';

  // Se reinicia el formulario cuando cambia el paso seleccionado
  const [pathCargado, setPathCargado] = useState(path);
  const [form, setForm] = useState({
    status: (celda?.status ?? 'vacio') as CellStatus,
    doneDate: celda?.done_date ?? HOY,
    comment: celda?.comment ?? '',
    secondComment: celda?.second_comment ?? '',
    branchValue: celda?.branch_value ?? null as boolean | null,
    dueDate: celda?.due_date ?? '',
    referenceDate: celda?.reference_date ?? '',
  });
  const [error, setError] = useState('');

  if (pathCargado !== path) {
    setPathCargado(path);
    setForm({
      status: (celda?.status ?? 'vacio') as CellStatus,
      doneDate: celda?.done_date ?? HOY,
      comment: celda?.comment ?? '',
      secondComment: celda?.second_comment ?? '',
      branchValue: celda?.branch_value ?? null,
      dueDate: celda?.due_date ?? '',
      referenceDate: celda?.reference_date ?? '',
    });
    setError('');
  }

  /** Corre antes de pedir confirmación -- si algo falta, se avisa de una vez
   *  en vez de hacer confirmar algo que de todas formas va a fallar. */
  function validar(): boolean {
    setError('');

    if (form.status === 'terminado') {
      if (!form.doneDate) { setError('Para marcar como terminado hace falta la fecha'); return false; }
      if (step.commentRequired && !form.comment.trim()) {
        setError(`Este paso requiere ${(step.commentLabel ?? 'un comentario').toLowerCase()}`);
        return false;
      }
      if (step.secondCommentRequired && !form.secondComment.trim()) {
        setError(`Este paso requiere ${(step.secondCommentLabel ?? 'un segundo comentario').toLowerCase()}`);
        return false;
      }
      if (step.isBranchPoint && form.branchValue === null) {
        setError('Elige una de las dos opciones');
        return false;
      }
    }

    return true;
  }

  async function guardar() {
    try {
      const celdaGuardada = await api.patch<MatrixCell>(
        `/subjects/${subjectId}/matrix/${path}`,
        {
          status: form.status,
          doneDate: form.doneDate || null,
          comment: form.comment.trim() || null,
          secondComment: form.secondComment.trim() || null,
          branchValue: step.isBranchPoint ? form.branchValue : null,
          dueDate: step.hasDueDate ? form.dueDate || null : null,
          referenceDate: step.autoDueDate ? form.referenceDate || null : null,
          version: celda?.version,
        }
      );
      onGuardado(celdaGuardada);
      onCerrar();
    } catch (err: any) {
      // El error se muestra en el modal de confirmación (ver BotonConfirmar),
      // no acá -- por eso se relanza en vez de guardarlo en el estado local.
      if (err.status === 409) {
        if (onRecargar) onRecargar();
        throw new Error('Otro usuario modificó esta celda. Recargando...');
      }
      throw err;
    }
  }

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-800 leading-snug">{etiquetaPaso(step, paso.instance)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{path}</p>
        </div>
        <button
          onClick={onCerrar}
          className="text-slate-400 hover:text-slate-700 text-lg leading-none shrink-0"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {esTipoContrato && (
        <DocentesContrato
          subjectId={subjectId}
          teachers={teachers}
          onCambiados={onTeachersChanged}
          onCeldaActualizada={onGuardado}
        />
      )}

      {step.isBranchPoint ? (
        <div className="space-y-1.5 mb-3">
          <BotonDecision
            activo={form.branchValue === false}
            titulo="No hay ajustes"
            nota="Continúa al siguiente paso"
            onClick={() => setForm({ ...form, branchValue: false })}
          />
          <BotonDecision
            activo={form.branchValue === true}
            titulo="Sí hay ajustes"
            nota="Habilita los pasos de ajuste"
            onClick={() => setForm({ ...form, branchValue: true })}
          />
        </div>
      ) : null}

      <div className="space-y-1 mb-3">
        {ORDEN_ESTADOS.map((estado) => {
          const e = ESTADOS[estado];
          const activo = form.status === estado;
          return (
            <button
              key={estado}
              onClick={() => setForm({ ...form, status: estado })}
              className={`flex items-center gap-2 w-full h-8 px-2 rounded-md text-[12px] text-left
                          border transition-colors ${
                activo
                  ? 'border-cyan-600 bg-cyan-50 text-slate-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                style={{ background: e.fondo, border: '0.5px solid rgba(0,0,0,.15)' }}
              />
              {e.label}
            </button>
          );
        })}
      </div>

      <label className="block mb-3">
        <span className="text-[11px] text-slate-500">Fecha</span>
        <input
          type="date"
          value={form.doneDate}
          onChange={(e) => setForm({ ...form, doneDate: e.target.value })}
          className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 text-[12px]
                     outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>

      {step.autoDueDate ? (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500">
            {step.autoDueDate.referenceLabel ?? 'Fecha inicial'}
          </span>
          <input
            type="date"
            value={form.referenceDate}
            onChange={(e) => setForm({ ...form, referenceDate: e.target.value })}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
          <span className="block text-[10px] text-slate-400 mt-1">
            {form.referenceDate
              ? `Vence el ${fechaLegible(sumarDiasHabiles(form.referenceDate, step.autoDueDate.businessDays))} ` +
                `(${step.autoDueDate.businessDays} días hábiles después). Si para entonces sigue sin ` +
                'terminar, se avisa por correo al encargado -- no hace falta terminarlo antes si ya está listo.'
              : `Se calcula sola: ${step.autoDueDate.businessDays} días hábiles después de esta fecha.`}
          </span>
        </label>
      ) : step.hasDueDate && (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500">{step.dueDateLabel ?? 'Fecha límite'}</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
          <span className="block text-[10px] text-slate-400 mt-1">
            Avisa por correo al encargado si está por vencer y el paso sigue sin terminar.
          </span>
        </label>
      )}

      {step.hasComment && (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500">
            {step.commentLabel ?? 'Comentario'}
            {step.commentRequired && <span className="text-red-500"> *</span>}
          </span>
          <input
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder={step.commentRequired ? 'Requerido' : 'Opcional'}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
      )}

      {step.hasSecondComment && (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500">
            {step.secondCommentLabel ?? 'Segundo comentario'}
            {step.secondCommentRequired && <span className="text-red-500"> *</span>}
          </span>
          <input
            value={form.secondComment}
            onChange={(e) => setForm({ ...form, secondComment: e.target.value })}
            placeholder={step.secondCommentRequired ? 'Requerido' : 'Opcional'}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
      )}

      <Alerta>{error}</Alerta>

      <div className="flex items-center justify-between mt-3 gap-2">
        <span className="text-[10px] text-slate-400 shrink-0">
          {celda?.initials ? `Último: ${celda.initials}` : ''}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCerrar} className="text-[12px] text-slate-500 hover:text-slate-800">
            Cancelar
          </button>
          <BotonConfirmar
            variante="primario"
            etiqueta="Guardar"
            etiquetaConfirmar="Sí, guardar"
            titulo="Confirmar guardado"
            mensaje="¿Confirmás guardar estos cambios?"
            onValidar={validar}
            onConfirmar={guardar}
            className="h-8 px-3 text-[12px]"
          />
        </div>
      </div>
    </div>
  );
}

function BotonDecision({
  activo, titulo, nota, onClick,
}: { activo: boolean; titulo: string; nota: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-2.5 py-2 rounded-lg text-left border transition-colors ${
        activo
          ? 'border-cyan-600 bg-cyan-50'
          : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <span className="block text-[12px] font-medium text-slate-800">{titulo}</span>
      <span className="block text-[10px] text-slate-500 mt-0.5">{nota}</span>
    </button>
  );
}