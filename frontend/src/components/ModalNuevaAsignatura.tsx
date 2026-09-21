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
import type { Program, Subject } from '@shared/types';

interface Props {
  abierto: boolean;
  programa: Program;
  /** si viene, el modal edita esta asignatura en vez de crear una nueva */
  asignatura?: Subject | null;
  onCerrar: () => void;
  onGuardada: () => void;
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
  }
  if (abierto && !asignatura && idCargado !== null) {
    setIdCargado(null);
    setForm(VACIO);
    setLibroIgual(true);
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
      };

      if (esEdicion) {
        await api.patch(`/subjects/${asignatura!.id}`, datos);
      } else {
        // Los docentes y si el video lo graba el profesor todavía no se saben en este
        // momento -- se cargan después, desde la página de la asignatura ya creada.
        await api.post(`/programs/${programa.id}/subjects`, datos);
        setForm(VACIO);
        setLibroIgual(true);
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
            {esEdicion
              ? ' Si ya hay avance cargado en instancias que queden fuera de este número de créditos, no se pierde -- se sigue viendo y contando igual.'
              : ' Los docentes se asignan después, ya creada la asignatura.'}
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
