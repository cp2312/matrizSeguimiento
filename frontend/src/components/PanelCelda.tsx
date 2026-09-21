import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/useAuth';
import { BotonConfirmar } from './ui/BotonConfirmar';
import { Alerta } from './ui/Alerta';
import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados';
import { etiquetaPaso } from '../lib/bloques';
import { sumarDiasHabiles } from '@shared/businessDays';
import { parseStepPath } from '@shared/pipelineTemplate';
import { CATEGORIAS_ENCARGADO, CATEGORIAS_SIN_FECHA_EN_PASO } from '@shared/types';
import type { CategoriaEncargado, CellStatus, MatrixCell, ResolvedStep, SubjectCategoryOwner, SubjectTeacher } from '@shared/types';

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
  /** fecha tentativa de entrega del libro (una sola por asignatura, no por docente) */
  bookDueDate: string | null;
  onGuardado: (celda: MatrixCell) => void;
  onTeachersChanged: (teachers: SubjectTeacher[]) => void;
  onBookDueDateChanged: (bookDueDate: string | null) => void;
  onCerrar: () => void;
  onRecargar?: () => void;
  /** avisa hacia afuera si el formulario tiene cambios sin guardar (para
   *  preguntar antes de cerrar el modal y perderlos) */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Fecha de hoy local ('YYYY-MM-DD'). No usar toISOString: en zonas al oeste
 *  de UTC, al anochecer ya devuelve la fecha del día siguiente. */
function hoyLocal(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

type EdicionContrato = { start_date: string; end_date: string; contract_type: string };

type FormCelda = {
  status: CellStatus;
  doneDate: string;
  comment: string;
  secondComment: string;
  branchValue: boolean | null;
  dueDate: string;
  referenceDate: string;
};

/** El formulario arranca con los valores ya guardados de la celda (o los
 *  vacíos). Vivir en una función aparte permite comparar contra la foto
 *  inicial para saber si hay cambios sin guardar. */
function formInicialDe(celda: MatrixCell | undefined): FormCelda {
  return {
    status: (celda?.status ?? 'vacio') as CellStatus,
    doneDate: celda?.done_date ?? hoyLocal(),
    comment: celda?.comment ?? '',
    secondComment: celda?.second_comment ?? '',
    branchValue: celda?.branch_value ?? null,
    dueDate: celda?.due_date ?? '',
    referenceDate: celda?.reference_date ?? '',
  };
}

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
      const resto = { ...prev };
      delete resto[t.id];
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
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
        Esta asignatura todavía no tiene docentes asignados (ver "Docentes asignados" en la página).
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-2 mb-3">
      {teachers.map((t) => (
        <div key={t.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-md px-2.5 py-2 space-y-1.5">
          <p className="text-[12px] font-medium text-slate-800 dark:text-slate-100">{t.full_name}</p>
          <div className="flex gap-1.5">
            <label className="flex-1 block">
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Fecha inicio</span>
              <input
                type="date"
                value={valor(t, 'start_date')}
                onChange={(e) => setCampo(t, 'start_date', e.target.value)}
                className="w-full h-7 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>
            <label className="flex-1 block">
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Fecha fin</span>
              <input
                type="date"
                value={valor(t, 'end_date')}
                onChange={(e) => setCampo(t, 'end_date', e.target.value)}
                className="w-full h-7 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>
          </div>
          <input
            value={valor(t, 'contract_type')}
            placeholder="Tipo de contrato"
            onChange={(e) => setCampo(t, 'contract_type', e.target.value)}
            className="w-full h-7 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
          />

          {hayCambios(t) && (
            <div className="flex items-center justify-end gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => deshacer(t)}
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
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

/** Solo se entrega un libro por asignatura -- a diferencia del contrato, esta
 *  fecha no es por docente, así que vive aparte y se guarda sola. */
function FechaEntregaLibro({ subjectId, bookDueDate, onCambiada }: {
  subjectId: number;
  bookDueDate: string | null;
  onCambiada: (bookDueDate: string | null) => void;
}) {
  const [edicion, setEdicion] = useState<string | null>(null);
  const valorActual = edicion ?? (bookDueDate ?? '');
  const hayCambios = edicion !== null && edicion !== (bookDueDate ?? '');

  async function guardar() {
    const nuevaFecha = valorActual || null;
    const resultado = await api.patch<{ book_due_date: string | null }>(
      `/subjects/${subjectId}`, { bookDueDate: nuevaFecha }
    );
    onCambiada(resultado.book_due_date);
    setEdicion(null);
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-md px-2.5 py-2 space-y-1.5 mb-3">
      <label className="block">
        <span className="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">
          Fecha tentativa de entrega del libro
        </span>
        <input
          type="date"
          value={valorActual}
          onChange={(e) => setEdicion(e.target.value)}
          className="w-full h-7 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
        />
        <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          Una sola por asignatura (solo se entrega un libro). Si llega esa fecha y "Recepción de libro"
          sigue sin terminar, se avisa por correo al encargado de Libro.
        </span>
      </label>

      {hayCambios && (
        <div className="flex items-center justify-end gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setEdicion(null)}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
          >
            Deshacer
          </button>
          <BotonConfirmar
            etiqueta="Guardar"
            etiquetaConfirmar="Sí, guardar"
            titulo="Confirmar fecha de entrega"
            mensaje="¿Guardar esta fecha tentativa de entrega del libro?"
            onConfirmar={guardar}
            className="h-6 px-2 text-[11px]"
          />
        </div>
      )}
    </div>
  );
}

/** Los usuarios activos, para el desplegable de encargado -- solo hace falta
 *  pedirlos si de verdad se va a mostrar el selector (admin). */
function useUsuariosActivos(habilitado: boolean) {
  const { datos } = useFetch<{ id: number; full_name: string; active: boolean }[]>(
    habilitado ? '/auth/usuarios' : null
  );
  return datos?.filter((u) => u.active) ?? [];
}

/** Quién es el encargado de esta categoría para ESTA asignatura puntual --
 *  puede ser distinto del encargado global (ver Usuarios > Encargados por
 *  categoría). Solo un administrador puede cambiarlo; cualquiera lo ve. */
function EncargadoAsignatura({ subjectId, category, label }: {
  subjectId: number;
  category: CategoriaEncargado;
  label: string;
}) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.role === 'administrador';
  const { datos: encargados, recargar } = useFetch<SubjectCategoryOwner[]>(`/subjects/${subjectId}/encargados`);
  const usuarios = useUsuariosActivos(esAdmin);
  const [guardando, setGuardando] = useState(false);

  const fila = encargados?.find((e) => e.category === category);
  if (!fila) return null;

  async function cambiar(valor: string) {
    setGuardando(true);
    try {
      await api.put(`/subjects/${subjectId}/encargados/${category}`, { userId: valor ? Number(valor) : null });
      recargar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-md px-2.5 py-2 mb-3">
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">
        Encargado de {label} para esta asignatura
      </p>
      {esAdmin ? (
        <select
          value={fila.userId ? String(fila.userId) : ''}
          disabled={guardando}
          onChange={(e) => cambiar(e.target.value)}
          className="w-full h-7 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[11px] outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">
            {fila.globalUserFullName ? `Usar el general (${fila.globalUserFullName})` : 'Usar el general (sin asignar)'}
          </option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      ) : (
        <p className="text-[12px] text-slate-700 dark:text-slate-200">
          {fila.userFullName ?? fila.globalUserFullName ?? 'Sin asignar'}
          {!fila.esPropio && fila.globalUserFullName && ' (general)'}
        </p>
      )}
    </div>
  );
}

export function PanelCelda({
  subjectId, paso, celda, teachers, bookDueDate,
  onGuardado, onTeachersChanged, onBookDueDateChanged, onCerrar, onRecargar, onDirtyChange,
}: Props) {
  const { step, path } = paso;
  const esTipoContrato = path === 'contrato.tipo_contrato';

  // El selector de encargado propio de esta asignatura solo tiene sentido
  // mostrarlo donde de verdad se manda un correo por esa categoría: en el
  // paso puntual con fecha límite (ovas/podcast/video_contenido/guias/libro),
  // o en "Tipo de contrato" (avisa por la fecha de fin de contrato, no por
  // una fecha límite propia -- ver CATEGORIAS_SIN_FECHA_EN_PASO). El resto de
  // los pasos (p. ej. "ISBN"/"Corrección de estilo" en Libro, o cualquier
  // paso de "Cuestionario final", que no tiene ninguno con fecha límite)
  // nunca disparan un aviso por esa categoría, así que ahí no se muestra.
  const { blockKey } = parseStepPath(path);
  const tieneCategoria = blockKey in CATEGORIAS_ENCARGADO && blockKey !== 'jefe';
  const avisaPorEstePaso = tieneCategoria
    && (!!step.hasDueDate || !!step.autoDueDate || CATEGORIAS_SIN_FECHA_EN_PASO.includes(blockKey as CategoriaEncargado));
  const categoriaEncargado = avisaPorEstePaso ? (blockKey as CategoriaEncargado) : null;

  // El formulario se remonta entero (key={path} en ModalApartado) cuando cambia
  // el paso, así que el estado arranca fresco en cada paso sin reset manual.
  const [form, setForm] = useState<FormCelda>(() => formInicialDe(celda));
  const [error, setError] = useState('');
  // Foto de los valores con los que arrancó el formulario -- si el usuario
  // no toca nada, no hay nada que perder al cerrar.
  const inicialRef = useRef<FormCelda>(form);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const i = inicialRef.current;
    const esDirty = form.status !== i.status || form.doneDate !== i.doneDate
      || form.comment !== i.comment || form.secondComment !== i.secondComment
      || form.branchValue !== i.branchValue || form.dueDate !== i.dueDate
      || form.referenceDate !== i.referenceDate;
    setDirty(esDirty);
  }, [form]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

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
      onDirtyChange?.(false);
      onCerrar();
    } catch (err) {
      // El error se muestra en el modal de confirmación (ver BotonConfirmar),
      // no acá -- por eso se relanza en vez de guardarlo en el estado local.
      if (err instanceof ApiError && err.status === 409) {
        if (onRecargar) onRecargar();
        throw new Error('Otro usuario modificó esta celda. Recargando...', { cause: err });
      }
      throw err;
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-snug">{etiquetaPaso(step, paso.instance)}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{path}</p>
        </div>
        <button
          onClick={onCerrar}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-lg leading-none shrink-0"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {categoriaEncargado && (
        <EncargadoAsignatura
          subjectId={subjectId}
          category={categoriaEncargado}
          label={CATEGORIAS_ENCARGADO[categoriaEncargado]}
        />
      )}

      {esTipoContrato && (
        <>
          <FechaEntregaLibro subjectId={subjectId} bookDueDate={bookDueDate} onCambiada={onBookDueDateChanged} />
          <DocentesContrato
            subjectId={subjectId}
            teachers={teachers}
            onCambiados={onTeachersChanged}
            onCeldaActualizada={onGuardado}
          />
        </>
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
        {(step.customStates ?? ORDEN_ESTADOS.map((estado) => ({ value: estado, label: ESTADOS[estado].label }))).map(
          ({ value: estado, label }) => {
            const e = ESTADOS[estado];
            const activo = form.status === estado;
            return (
              <button
                key={estado}
                onClick={() => setForm({ ...form, status: estado })}
                className={`flex items-center gap-2 w-full h-8 px-2 rounded-md text-[12px] text-left
                            border transition-colors ${
                  activo
                    ? 'border-cyan-600 bg-cyan-50 text-slate-900 dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-slate-100'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-sm shrink-0"
                  style={{ background: e.fondo, border: '0.5px solid rgba(0,0,0,.15)' }}
                />
                {label}
              </button>
            );
          }
        )}
      </div>

      <label className="block mb-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Fecha</span>
        <input
          type="date"
          value={form.doneDate}
          onChange={(e) => setForm({ ...form, doneDate: e.target.value })}
          className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[12px]
                     outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>

      {step.autoDueDate ? (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {step.autoDueDate.referenceLabel ?? 'Fecha inicial'}
          </span>
          <input
            type="date"
            value={form.referenceDate}
            onChange={(e) => setForm({ ...form, referenceDate: e.target.value })}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
          <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            {form.referenceDate
              ? `Vence el ${fechaLegible(sumarDiasHabiles(form.referenceDate, step.autoDueDate.businessDays))} ` +
                `(${step.autoDueDate.businessDays} días hábiles después). Si para entonces sigue sin ` +
                'terminar, se avisa por correo al encargado -- no hace falta terminarlo antes si ya está listo.'
              : `Se calcula sola: ${step.autoDueDate.businessDays} días hábiles después de esta fecha.`}
          </span>
        </label>
      ) : step.hasDueDate && (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{step.dueDateLabel ?? 'Fecha límite'}</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
          <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Avisa por correo al encargado si está por vencer y el paso sigue sin terminar.
          </span>
        </label>
      )}

      {step.hasComment && (!step.commentSoloSiTerminado || form.status === 'terminado') && (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {step.commentLabel ?? 'Comentario'}
            {step.commentRequired && <span className="text-red-500"> *</span>}
          </span>
          <input
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder={step.commentRequired ? 'Requerido' : 'Opcional'}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
      )}

      {step.hasSecondComment && (
        <label className="block mb-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {step.secondCommentLabel ?? 'Segundo comentario'}
            {step.secondCommentRequired && <span className="text-red-500"> *</span>}
          </span>
          <input
            value={form.secondComment}
            onChange={(e) => setForm({ ...form, secondComment: e.target.value })}
            placeholder={step.secondCommentRequired ? 'Requerido' : 'Opcional'}
            className="w-full h-8 mt-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[12px]
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
      )}

      <Alerta>{error}</Alerta>

      <div className="flex items-center justify-between mt-3 gap-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
          {celda?.initials ? `Último: ${celda.initials}` : ''}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCerrar} className="text-[12px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100">
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
    </>
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
          ? 'border-cyan-600 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-950/40'
          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
      }`}
    >
      <span className="block text-[12px] font-medium text-slate-800 dark:text-slate-100">{titulo}</span>
      <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{nota}</span>
    </button>
  );
}