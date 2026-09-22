import { useState } from 'react';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { ModalConfirmar } from './ui/ModalConfirmar';
import { Campo } from './ui/Campo';
import { Select } from './ui/Select';
import { Casilla } from './ui/Casilla';
import { AreaTexto } from './ui/AreaTexto';
import { Boton } from './ui/Boton';
import { Alerta } from './ui/Alerta';
import { totalSteps } from '@shared/pipelineTemplate';
import type { Program, Subject, SubjectTeacher } from '@shared/types';

interface Props {
  abierto: boolean;
  programa: Program;
  /** si viene, el modal edita esta asignatura en vez de crear una nueva */
  asignatura?: (Subject & { teachers?: SubjectTeacher[] }) | null;
  onCerrar: () => void;
  onGuardada: () => void;
}

/** Formato local de un docente dentro de este formulario -- mismo formato
 *  que espera el PATCH/POST (ver DocenteEntrada en backend/src/routes/subjects.ts).
 *  id ausente = docente nuevo; presente = docente ya existente (conserva sus
 *  fechas y tipo de contrato, que se siguen editando desde "Tipo de contrato"). */
interface DocenteFormEntry {
  id?: number;
  fullName: string;
  startDate: string | null;
  endDate: string | null;
  contractType: string | null;
}

function aFormEntry(t: SubjectTeacher): DocenteFormEntry {
  return { id: t.id, fullName: t.full_name, startDate: t.start_date, endDate: t.end_date, contractType: t.contract_type };
}

/** Lista de docentes asignados, editable de una vez al crear (o editar) la
 *  asignatura -- antes solo se podían agregar después, desde la página de la
 *  asignatura ya creada, y quedaba muy escondido. Las fechas y el tipo de
 *  contrato de cada uno se siguen llenando después, desde "Tipo de contrato". */
function DocentesForm({ docentes, onCambiar }: { docentes: DocenteFormEntry[]; onCambiar: (d: DocenteFormEntry[]) => void }) {
  const [nombreNuevo, setNombreNuevo] = useState('');

  // OJO: este bloque vive dentro del <form> principal del modal, así que no
  // puede tener su propio <form> anidado (HTML no lo permite y el botón de
  // "Agregar" terminaría enviando el formulario de afuera). Por eso "Agregar"
  // es type="button" con su propio onClick, y Enter se maneja a mano.
  function agregar() {
    if (!nombreNuevo.trim()) return;
    onCambiar([...docentes, { fullName: nombreNuevo.trim(), startDate: null, endDate: null, contractType: null }]);
    setNombreNuevo('');
  }

  function quitar(idx: number) {
    onCambiar(docentes.filter((_, i) => i !== idx));
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
      <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 mb-2">Docentes asignados</p>

      {docentes.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {docentes.map((d, idx) => (
            <div key={d.id ?? `nuevo-${idx}`} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 gap-2">
              <span className="text-[13px] text-slate-700 dark:text-slate-200 truncate">{d.fullName}</span>
              <button
                type="button"
                onClick={() => quitar(idx)}
                aria-label={`Quitar a ${d.fullName}`}
                className="shrink-0 text-slate-400 hover:text-red-600 text-sm leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          placeholder="Nombre del docente"
          className="flex-1 h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-[13px]
                     outline-none focus:ring-2 focus:ring-slate-400"
        />
        <Boton type="button" onClick={agregar} disabled={!nombreNuevo.trim()} className="h-9 px-3 text-[12px] shrink-0">
          + Agregar
        </Boton>
      </div>
      <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-1.5">
        Las fechas y el tipo de contrato de cada uno se llenan después, desde el apartado "Tipo de contrato".
      </p>
    </div>
  );
}

const SEMESTRES = Array.from({ length: 10 }, (_, i) => ({
  valor: `Semestre ${i + 1}`,
  etiqueta: `Semestre ${i + 1}`,
}));

const CREDITOS = [1, 2, 3, 4, 5].map((n) => ({
  valor: String(n),
  etiqueta: String(n),
}));

const MODALIDADES = [
  { valor: 'virtual', etiqueta: 'Virtual' },
  { valor: 'presencial', etiqueta: 'Presencial' },
];

const VACIO = {
  semester: 'Semestre 1',
  name: '',
  credits: '1',
  modality: 'presencial',
  hybridProgramLabel: '',
  bookName: '',
  generalComment: '',
};

export function ModalNuevaAsignatura({ abierto, programa, asignatura, onCerrar, onGuardada }: Props) {
  const esEdicion = !!asignatura;

  const [form, setForm] = useState(VACIO);
  const [libroIgual, setLibroIgual] = useState(true);
  const [docentes, setDocentes] = useState<DocenteFormEntry[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Primer clic en "Guardar" arma la confirmación; el segundo (sobre "Sí,
  // guardar") sí llama a la API. Cualquier edición vuelve a pedirla.
  const [confirmando, setConfirmando] = useState(false);

  // Precarga los datos al abrir en modo edición (o los reinicia si se vuelve a
  // abrir en modo creación) -- mismo patrón que ModalPrograma.
  const [idCargado, setIdCargado] = useState<number | null>(null);
  if (abierto && asignatura && idCargado !== asignatura.id) {
    setIdCargado(asignatura.id);
    setForm({
      semester: asignatura.semester,
      name: asignatura.name,
      credits: String(asignatura.credits),
      modality: asignatura.modality ?? 'presencial',
      hybridProgramLabel: asignatura.hybrid_program_label ?? '',
      bookName: asignatura.book_name ?? '',
      generalComment: asignatura.general_comment ?? '',
    });
    setLibroIgual(!!asignatura.book_name);
    setDocentes((asignatura.teachers ?? []).map(aFormEntry));
  }
  if (abierto && !asignatura && idCargado !== null) {
    setIdCargado(null);
    setForm(VACIO);
    setLibroIgual(true);
    setDocentes([]);
  }
  if (!abierto && confirmando) setConfirmando(false);

  const creditos = Number(form.credits);
  // Hibrido pide modalidad por asignatura; presencial (con asignatura
  // virtual) en cambio pide el nombre del programa. Son mutuamente excluyentes.
  const pideModalidad = programa.type === 'hibrido';
  const pideNombrePrograma = programa.type === 'presencial';
  const set = (campo: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [campo]: e.target.value });
    setConfirmando(false);
  };

  function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    setError('');
    setConfirmando(true);
  }

  async function confirmarGuardado() {
    setEnviando(true);

    try {
      const datos = {
        ...form,
        credits: creditos,
        modality: pideModalidad ? form.modality : null,
        hybridProgramLabel: pideNombrePrograma ? form.hybridProgramLabel : null,
        bookName: libroIgual ? form.bookName : null,
        teachers: docentes,
      };

      if (esEdicion) {
        await api.patch(`/subjects/${asignatura!.id}`, datos);
      } else {
        // Si lo graba el profesor todavía no se sabe en este momento -- se
        // marca después, desde la página de la asignatura ya creada.
        await api.post(`/programs/${programa.id}/subjects`, datos);
        setForm(VACIO);
        setLibroIgual(true);
        setDocentes([]);
      }

      setConfirmando(false);
      onGuardada();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo={esEdicion ? 'Editar asignatura' : 'Nueva asignatura'}
      subtitulo={programa.name}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviar} className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <div className="w-[160px]">
            <Select etiqueta="Semestre" opciones={SEMESTRES} value={form.semester} onChange={set('semester')} />
          </div>
          <div className="w-[100px]">
            <Select etiqueta="Créditos" opciones={CREDITOS} value={form.credits} onChange={set('credits')} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <Campo
              etiqueta="Espacio académico"
              required
              autoFocus
              value={form.name}
              onChange={set('name')}
            />
          </div>
        </div>

        <DocentesForm docentes={docentes} onCambiar={(d) => { setDocentes(d); setConfirmando(false); }} />

        {(pideModalidad || pideNombrePrograma) && (
          <div className="bg-teal-50 dark:bg-teal-950/40 rounded-lg p-3">
            <p className="text-[11px] text-teal-700 dark:text-teal-300 mb-3">
              {pideNombrePrograma ? 'Este programa es presencial con asignatura virtual' : 'Este programa es híbrido'}
            </p>
            <div className="flex flex-wrap gap-3">
              {pideNombrePrograma && (
                <div className="flex-1 min-w-[220px]">
                  <Campo
                    etiqueta="Nombre del programa"
                    required
                    value={form.hybridProgramLabel}
                    onChange={set('hybridProgramLabel')}
                  />
                </div>
              )}
              {pideModalidad && (
                <div className="w-[160px]">
                  <Select etiqueta="Modalidad" opciones={MODALIDADES} value={form.modality} onChange={set('modality')} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Casilla
            etiqueta="¿El nombre del programa y el libro es igual?"
            checked={libroIgual}
            onChange={(e) => { setLibroIgual(e.target.checked); setConfirmando(false); }}
          />

          {libroIgual && (
            <div className="flex-1 min-w-[220px]">
              <Campo etiqueta="Nombre del libro" required value={form.bookName} onChange={set('bookName')} />
            </div>
          )}
        </div>

        <AreaTexto
          etiqueta="Observaciones"
          rows={2}
          value={form.generalComment}
          onChange={set('generalComment')}
        />

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Con {creditos} {creditos === 1 ? 'crédito' : 'créditos'} corresponden {creditos}{' '}
            {creditos === 1 ? 'OVA' : 'OVAs'}, {creditos} {creditos === 1 ? 'video' : 'videos'} de
            contenido, {creditos} {creditos === 1 ? 'guía' : 'guías'} y 2 infografías.
            En total {totalSteps(creditos)} pasos.
            {esEdicion &&
              ' Si ya hay avance cargado en instancias que queden fuera de este número de créditos, no se pierde -- se sigue viendo y contando igual.'}
          </p>
        </div>

        <Alerta>{error}</Alerta>

        {confirmando && (
          <p className="text-[13px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            ¿Confirmás {esEdicion ? 'guardar los cambios en' : 'crear la asignatura'}{' '}
            <strong>{form.name || (esEdicion ? 'esta asignatura' : 'la nueva asignatura')}</strong>?
          </p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Boton type="button" onClick={() => (confirmando ? setConfirmando(false) : onCerrar())}>
            {confirmando ? 'Volver' : 'Cancelar'}
          </Boton>
          <Boton type="submit" variante="primario" disabled={enviando}>
            {enviando ? 'Guardando…' : confirmando ? 'Sí, guardar' : esEdicion ? 'Guardar cambios' : 'Crear asignatura'}
          </Boton>
        </div>
      </form>

      <ModalConfirmar
        abierto={confirmando}
        titulo={esEdicion ? 'Confirmar cambios' : 'Confirmar creación'}
        mensaje={
          <>
            ¿Confirmás {esEdicion ? 'guardar los cambios en' : 'crear la asignatura'}{' '}
            <strong>{form.name || (esEdicion ? 'esta asignatura' : 'la nueva asignatura')}</strong>?
          </>
        }
        textoConfirmar={esEdicion ? 'Sí, guardar' : 'Sí, crear'}
        enviando={enviando}
        error={error}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={confirmarGuardado}
      />
    </Modal>
  );
}
