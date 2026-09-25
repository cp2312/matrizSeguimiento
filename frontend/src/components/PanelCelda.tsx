import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/useAuth';
import { BotonConfirmar } from './ui/BotonConfirmar';
import { Alerta } from './ui/Alerta';
import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados';
import { etiquetaPaso } from '../lib/bloques';
import { sumarDiasHabiles, hoyISO } from '@shared/businessDays';
import { parseStepPath, esPasoPropagable, pasoPideFechaLimite, PIPELINE_TEMPLATE } from '@shared/pipelineTemplate';
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
  /** los videos de esta asignatura los graba el profesor -- de eso depende si
   *  "Creación de guión" de Video de contenido pide fecha límite (ver pasoPideFechaLimite) */
  videoPorDocente: boolean;
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
    doneDate: celda?.done_date ?? hoyISO(),
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

/** Consistente para todos los campos de texto/fecha del formulario */
const CAMPO_INPUT = `
  w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700
  bg-white dark:bg-slate-950/50 dark:text-slate-100 text-[12px]
  outline-none transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600
  focus:border-slate-400 focus:ring-2 focus:ring-cyan-600/20
`;

/** Etiqueta de sección: mayúsculas pequeñas en gris */
const ETIQUETA_SECCION = 'mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500';

/** Tarjeta contenedora de las subsecciones (encargado, contrato, libro) */
const TARJETA = 'rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-3.5 py-3 mb-4';

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
    <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
      {teachers.map((t) => (
        <div key={t.id} className={TARJETA}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px] font-semibold shrink-0">
              {t.full_name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')}
            </span>
            <p className="text-[12px] font-medium text-slate-800 dark:text-slate-100 truncate">{t.full_name}</p>
          </div>
          <div className="flex gap-2">
            <label className="flex-1 block">
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 mb-1">Fecha inicio</span>
              <input
                type="date"
                value={valor(t, 'start_date')}
                onChange={(e) => setCampo(t, 'start_date', e.target.value)}
                className={CAMPO_INPUT}
              />
            </label>
            <label className="flex-1 block">
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 mb-1">Fecha fin</span>
              <input
                type="date"
                value={valor(t, 'end_date')}
                onChange={(e) => setCampo(t, 'end_date', e.target.value)}
                className={CAMPO_INPUT}
              />
            </label>
          </div>
          <input
            value={valor(t, 'contract_type')}
            placeholder="Tipo de contrato"
            onChange={(e) => setCampo(t, 'contract_type', e.target.value)}
            className={`${CAMPO_INPUT} mt-2 h-8`}
          />

          {hayCambios(t) && (
            <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
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
                className="h-7 px-2.5 text-[11px]"
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
  const [error, setError] = useState('');
  const valorActual = edicion ?? (bookDueDate ?? '');
  const hayCambios = edicion !== null && edicion !== (bookDueDate ?? '');

  function validar(): boolean {
    setError('');
    if (valorActual && valorActual < hoyISO()) {
      setError('La fecha tentativa no puede ser anterior a hoy');
      return false;
    }
    return true;
  }

  async function guardar() {
    const nuevaFecha = valorActual || null;
    const resultado = await api.patch<{ book_due_date: string | null }>(
      `/subjects/${subjectId}`, { bookDueDate: nuevaFecha }
    );
    onCambiada(resultado.book_due_date);
    setEdicion(null);
  }

  return (
    <div className={`${TARJETA} mb-4`}>
      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
          Fecha tentativa de entrega del libro
        </span>
        <input
          type="date"
          value={valorActual}
          min={hoyISO()}
          onChange={(e) => { setEdicion(e.target.value); setError(''); }}
          className={CAMPO_INPUT}
        />
        <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
          Una sola por asignatura (solo se entrega un libro). Si llega esa fecha y "Recepción de libro"
          sigue sin terminar, se avisa por correo al encargado de Libro.
        </span>
      </label>

      <Alerta>{error}</Alerta>

      {hayCambios && (
        <div className="flex items-center justify-end gap-2 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => { setEdicion(null); setError(''); }}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
          >
            Deshacer
          </button>
          <BotonConfirmar
            etiqueta="Guardar"
            etiquetaConfirmar="Sí, guardar"
            titulo="Confirmar fecha de entrega"
            mensaje="¿Guardar esta fecha tentativa de entrega del libro?"
            onValidar={validar}
            onConfirmar={guardar}
            className="h-7 px-2.5 text-[11px]"
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
    <div className={TARJETA}>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
        Encargado de {label}
      </p>
      {esAdmin ? (
        <select
          value={fila.userId ? String(fila.userId) : ''}
          disabled={guardando}
          onChange={(e) => cambiar(e.target.value)}
          className={CAMPO_INPUT}
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
  subjectId, paso, celda, teachers, videoPorDocente, bookDueDate,
  onGuardado, onTeachersChanged, onBookDueDateChanged, onCerrar, onRecargar, onDirtyChange,
}: Props) {
  const { step, path } = paso;
  const esTipoContrato = path === 'contrato.tipo_contrato';

  const { blockKey } = parseStepPath(path);
  const pideFechaLimite = pasoPideFechaLimite(step, videoPorDocente);

  // Pasos de los "de siempre igual" en un bloque repetible (OVA, Podcast,
  // Video de contenido, Guía, Infografía): al marcarlo como terminado, el
  // backend lo completa solo en las demás instancias que todavía lo tengan
  // vacío (ver esPasoPropagable/propagarATodasLasInstancias). Solo informa --
  // la decisión real la toma el backend al guardar.
  const bloqueDelPaso = PIPELINE_TEMPLATE.find((b) => b.key === blockKey);
  const propagable = bloqueDelPaso ? esPasoPropagable(bloqueDelPaso, step) : false;

  // El formulario se remonta entero (key={path} en ModalApartado) cuando cambia
  // el paso, así que el estado arranca fresco en cada paso sin reset manual.
  const [form, setForm] = useState<FormCelda>(() => formInicialDe(celda));
  const [error, setError] = useState('');

  // El selector de encargado propio de esta asignatura solo tiene sentido
  // mostrarlo donde de verdad se manda un correo por esa categoría: en el
  // paso puntual con fecha límite (podcast/video_contenido/cuestionario_final/libro),
  // en "Tipo de contrato" (avisa por la fecha de fin de contrato, no por una
  // fecha límite propia -- ver CATEGORIAS_SIN_FECHA_EN_PASO), o en cualquier
  // paso que esté "En proceso" -- quien lo puso así no es necesariamente quien
  // le va a hacer seguimiento, así que ahí también conviene poder anotar
  // quién quedó a cargo.
  const tieneCategoria = blockKey in CATEGORIAS_ENCARGADO && blockKey !== 'jefe';
  const avisaPorEstePaso = tieneCategoria
    && (pideFechaLimite || !!step.autoDueDate || CATEGORIAS_SIN_FECHA_EN_PASO.includes(blockKey as CategoriaEncargado)
        || form.status === 'pendiente_equipo');
  const categoriaEncargado = avisaPorEstePaso ? (blockKey as CategoriaEncargado) : null;
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

    // La fecha límite se escribe a mano solo cuando NO es autoDueDate (esa se
    // calcula sola a partir de referenceDate, que sí puede quedar en el
    // pasado -- p. ej. "enviado al experto el..." registrado después).
    if (pideFechaLimite && !step.autoDueDate && form.dueDate && form.dueDate < hoyISO()) {
      setError(`${step.dueDateLabel ?? 'La fecha límite'} no puede ser anterior a hoy`);
      return false;
    }

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
          dueDate: pideFechaLimite ? form.dueDate || null : null,
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

  // Enter en cualquier campo de texto/fecha dispara la misma acción que el
  // botón "Guardar cambios" -- la primera vez abre la confirmación, y con la
  // confirmación ya abierta, confirma (ese es siempre el último botón
  // dentro de este contenedor: BotonConfirmar deja su propio botón montado
  // y, encima, "Cancelar"/"Sí, guardar" del modal de confirmación una vez
  // abierto). Los botones de Estado/Decisión ya reaccionan solos a Enter
  // por ser <button>, así que ahí no hace falta tocar nada.
  const pieRef = useRef<HTMLDivElement>(null);
  function manejarEnterFormulario(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
    e.preventDefault();
    const botones = pieRef.current?.querySelectorAll('button');
    if (botones?.length) botones[botones.length - 1].click();
  }

  return (
    <div className="max-w-lg mx-auto" onKeyDown={manejarEnterFormulario}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            {etiquetaPaso(step, paso.instance)}
          </p>
          <span className="mt-1 inline-block max-w-full truncate rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500">
            {path}
          </span>
        </div>
        <button
          onClick={onCerrar}
          className="shrink-0 rounded-md p-1 text-lg leading-none text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

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

      {categoriaEncargado && (
        <EncargadoAsignatura
          subjectId={subjectId}
          category={categoriaEncargado}
          label={CATEGORIAS_ENCARGADO[categoriaEncargado]}
        />
      )}

      {/* Estado */}
      <section className="mb-5">
        <h3 className={ETIQUETA_SECCION}>Estado</h3>
        <div className="space-y-1.5">
          {(step.customStates ?? ORDEN_ESTADOS.map((estado) => ({ value: estado, label: ESTADOS[estado].label }))).map(
            ({ value: estado, label }) => {
              const e = ESTADOS[estado];
              const activo = form.status === estado;
              return (
                <button
                  key={estado}
                  onClick={() => setForm({ ...form, status: estado })}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 text-left text-[12px] transition-colors ${
                    activo
                      ? 'h-9 border-cyan-600 bg-cyan-50/70 font-medium text-slate-900 dark:border-cyan-500 dark:bg-cyan-500/10 dark:text-slate-100'
                      : 'h-9 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                    style={{ background: e.fondo }}
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {activo && (
                    <svg className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            }
          )}
        </div>
        {propagable && (
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
            Al marcar este paso como terminado, se completa solo también en las demás tarjetas de
            "{bloqueDelPaso!.label}" de esta asignatura que todavía lo tengan vacío.
          </p>
        )}
      </section>

      {/* Decisión del paso */}
      {step.isBranchPoint && (
        <section className="mb-5">
          <h3 className={ETIQUETA_SECCION}>¿Hay ajustes?</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
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
        </section>
      )}

      {/* Fechas -- "Tipo de contrato" ya tiene sus propias fechas por docente
          arriba (ver DocentesContrato) y no tiene fecha límite propia, así
          que no repite "Fecha de terminado" acá: se guarda sola con la fecha
          de hoy al marcarlo como terminado. */}
      {!esTipoContrato && (
      <section className="mb-5">
        <h3 className={ETIQUETA_SECCION}>Fechas</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Fecha de terminado</span>
            <input
              type="date"
              value={form.doneDate}
              onChange={(e) => setForm({ ...form, doneDate: e.target.value })}
              className={CAMPO_INPUT}
            />
          </label>

          {step.autoDueDate ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {step.autoDueDate.referenceLabel ?? 'Fecha inicial'}
              </span>
              <input
                type="date"
                value={form.referenceDate}
                onChange={(e) => setForm({ ...form, referenceDate: e.target.value })}
                className={CAMPO_INPUT}
              />
            </label>
          ) : pideFechaLimite && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {step.dueDateLabel ?? 'Fecha límite'}
              </span>
              <input
                type="date"
                value={form.dueDate}
                min={hoyISO()}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={CAMPO_INPUT}
              />
            </label>
          )}
        </div>

        {(step.autoDueDate || pideFechaLimite) && (
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
            {step.autoDueDate
              ? (form.referenceDate
                ? `Vence el ${fechaLegible(sumarDiasHabiles(form.referenceDate, step.autoDueDate.businessDays))} ` +
                  `(${step.autoDueDate.businessDays} días hábiles después). Si para entonces sigue sin ` +
                  'terminar, se avisa por correo al encargado -- no hace falta terminarlo antes si ya está listo.'
                : `Se calcula sola: ${step.autoDueDate.businessDays} días hábiles después de esta fecha.`)
              : 'Avisa por correo al encargado si está por vencer y el paso sigue sin terminar.'}
          </p>
        )}
      </section>
      )}

      {/* Comentarios */}
      {(step.hasComment || step.hasSecondComment) && (
        <section className="mb-5 space-y-3">
          <h3 className={ETIQUETA_SECCION}>Detalles</h3>

          {step.hasComment && (!step.commentSoloSiTerminado || form.status === 'terminado') && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {step.commentLabel ?? 'Comentario'}
                {step.commentRequired && <span className="text-red-500"> *</span>}
              </span>
              <input
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder={step.commentRequired ? 'Requerido' : 'Opcional'}
                className={CAMPO_INPUT}
              />
            </label>
          )}

          {step.hasSecondComment && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {step.secondCommentLabel ?? 'Segundo comentario'}
                {step.secondCommentRequired && <span className="text-red-500"> *</span>}
              </span>
              <input
                value={form.secondComment}
                onChange={(e) => setForm({ ...form, secondComment: e.target.value })}
                placeholder={step.secondCommentRequired ? 'Requerido' : 'Opcional'}
                className={CAMPO_INPUT}
              />
            </label>
          )}
        </section>
      )}

      <Alerta>{error}</Alerta>

      {/* Pie */}
      <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          {celda?.initials ? (
            <>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {celda.initials.slice(0, 2)}
              </span>
              <span className="truncate">Último: {celda.initials}</span>
            </>
          ) : 'Aún sin registrar cambios'}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onCerrar}
            className="h-9 rounded-lg px-3.5 text-[12px] text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancelar
          </button>
          <div ref={pieRef}>
            <BotonConfirmar
              variante="primario"
              etiqueta="Guardar cambios"
              etiquetaConfirmar="Sí, guardar"
              titulo="Confirmar guardado"
              mensaje="¿Confirmás guardar estos cambios?"
              onValidar={validar}
              onConfirmar={guardar}
              className="h-9 px-4 text-[12px]"
            />
          </div>
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
      className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        activo
          ? 'border-cyan-600 bg-cyan-50/70 dark:border-cyan-500 dark:bg-cyan-500/10'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
      }`}
    >
      <span className={`flex items-center gap-2 text-[12px] font-medium ${activo ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-800 dark:text-slate-100'}`}>
        <span className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
          activo ? 'border-cyan-600 bg-cyan-600 dark:border-cyan-400 dark:bg-cyan-400' : 'border-slate-300 dark:border-slate-600'
        }`}>
          {activo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        {titulo}
      </span>
      <span className="pl-6 text-[10px] text-slate-500 dark:text-slate-400">{nota}</span>
    </button>
  );
}