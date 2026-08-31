import { useState } from 'react';
import { api } from '../lib/api';
import { Boton } from './ui/Boton';
import { Alerta } from './ui/Alerta';
import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados';
import type { CellStatus, MatrixCell, ResolvedStep, SubjectTeacher } from '@shared/types';

interface Props {
  subjectId: number;
  paso: ResolvedStep;
  celda?: MatrixCell;
  teachers: SubjectTeacher[];
  onGuardado: (celda: MatrixCell) => void;
  onCerrar: () => void;
}

const HOY = new Date().toISOString().slice(0, 10);

function formatearFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** El tipo de contrato de cada docente ya se cargó al crear/editar la asignatura;
 *  este paso solo lo muestra, no hace falta volver a escribirlo. */
function DocentesContrato({ teachers }: { teachers: SubjectTeacher[] }) {
  if (teachers.length === 0) {
    return <p className="text-[11px] text-slate-400 mb-3">Esta asignatura no tiene docentes cargados.</p>;
  }

  return (
    <div className="space-y-1.5 mb-3">
      {teachers.map((t) => (
        <div key={t.id} className="bg-slate-50 rounded-md px-2.5 py-2">
          <p className="text-[12px] font-medium text-slate-800">{t.full_name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t.contract_type || 'Sin tipo de contrato'}
          </p>
          <p className="text-[10.5px] text-slate-400 mt-0.5">
            {formatearFecha(t.start_date)} → {formatearFecha(t.end_date)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function PanelCelda({ subjectId, paso, celda, teachers, onGuardado, onCerrar }: Props) {
  const { step, path } = paso;
  const esTipoContrato = path === 'contrato.tipo_contrato';

  // Se reinicia el formulario cuando cambia el paso seleccionado
  const [pathCargado, setPathCargado] = useState(path);
  const [form, setForm] = useState({
    status: (celda?.status ?? 'vacio') as CellStatus,
    doneDate: celda?.done_date ?? HOY,
    comment: celda?.comment ?? '',
    branchValue: celda?.branch_value ?? null as boolean | null,
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (pathCargado !== path) {
    setPathCargado(path);
    setForm({
      status: (celda?.status ?? 'vacio') as CellStatus,
      doneDate: celda?.done_date ?? HOY,
      comment: celda?.comment ?? '',
      branchValue: celda?.branch_value ?? null,
    });
    setError('');
  }

  async function guardar() {
    setError('');

    if (form.status === 'terminado') {
      if (!form.doneDate) return setError('Para marcar como terminado hace falta la fecha');
      if (step.commentRequired && !form.comment.trim()) {
        return setError(`Este paso requiere ${(step.commentLabel ?? 'un comentario').toLowerCase()}`);
      }
      if (step.isBranchPoint && form.branchValue === null) {
        return setError('Elige una de las dos opciones');
      }
    }

    setEnviando(true);
    try {
      const celdaGuardada = await api.patch<MatrixCell>(
        `/subjects/${subjectId}/matrix/${path}`,
        {
          status: form.status,
          doneDate: form.doneDate || null,
          comment: form.comment.trim() || null,
          branchValue: step.isBranchPoint ? form.branchValue : null,
        }
      );
      onGuardado(celdaGuardada);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-800 leading-snug">{step.label}</p>
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

      {esTipoContrato && <DocentesContrato teachers={teachers} />}

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

      <Alerta>{error}</Alerta>

      <div className="flex items-center justify-between mt-3">
        <span className="text-[10px] text-slate-400">
          {celda?.initials ? `Último: ${celda.initials}` : ''}
        </span>
        <Boton variante="primario" onClick={guardar} disabled={enviando} className="h-8 px-3 text-[12px]">
          {enviando ? 'Guardando…' : 'Guardar'}
        </Boton>
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