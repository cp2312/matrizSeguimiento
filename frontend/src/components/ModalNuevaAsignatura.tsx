import { useState } from 'react';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Campo } from './ui/Campo';
import { Select } from './ui/Select';
import { Casilla } from './ui/Casilla';
import { AreaTexto } from './ui/AreaTexto';
import { Boton } from './ui/Boton';
import { Alerta } from './ui/Alerta';
import { totalSteps } from '@shared/pipelineTemplate';
import type { Program } from '@shared/types';

interface Props {
  abierto: boolean;
  programa: Program;
  onCerrar: () => void;
  onCreada: () => void;
}

interface DocenteForm {
  fullName: string;
  startDate: string;
  endDate: string;
  contractType: string;
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

const DOCENTE_VACIO: DocenteForm = {
  fullName: '', startDate: '', endDate: '', contractType: '',
};

const VACIO = {
  semester: 'Semestre 1',
  name: '',
  credits: '1',
  modality: 'virtual',
  hybridProgramLabel: '',
  bookName: '',
  generalComment: '',
  videosPorDocente: false,
};

export function ModalNuevaAsignatura({ abierto, programa, onCerrar, onCreada }: Props) {
  const [form, setForm] = useState(VACIO);
  const [docentes, setDocentes] = useState<DocenteForm[]>([{ ...DOCENTE_VACIO }]);
  const [libroIgual, setLibroIgual] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const creditos = Number(form.credits);
  const set = (campo: keyof typeof VACIO) => (e: React.ChangeEvent<any>) =>
    setForm({ ...form, [campo]: e.target.value });

  function setDocente(i: number, campo: keyof DocenteForm, valor: string) {
    setDocentes(docentes.map((d, idx) => (idx === i ? { ...d, [campo]: valor } : d)));
  }

  function agregarDocente() {
    setDocentes([...docentes, { ...DOCENTE_VACIO }]);
  }

  function quitarDocente(i: number) {
    setDocentes(docentes.filter((_, idx) => idx !== i));
  }

  function reiniciar() {
    setForm(VACIO);
    setDocentes([{ ...DOCENTE_VACIO }]);
    setLibroIgual(true);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      await api.post(`/programs/${programa.id}/subjects`, {
        ...form,
        credits: creditos,
        modality: programa.type === 'hibrido' ? form.modality : null,
        hybridProgramLabel: programa.type === 'hibrido' ? form.hybridProgramLabel : null,
        bookName: libroIgual ? form.bookName : null,
        teachers: docentes.map((d) => ({
          fullName: d.fullName,
          startDate: d.startDate || null,
          endDate: d.endDate || null,
          contractType: d.contractType || null,
        })),
      });

      reiniciar();
      onCreada();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Nueva asignatura"
      subtitulo={programa.name}
      ancho="grande"
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

        {programa.type === 'hibrido' && (
          <div className="bg-teal-50 rounded-lg p-3">
            <p className="text-[11px] text-teal-700 mb-3">Este programa es híbrido</p>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[220px]">
                <Campo
                  etiqueta="Nombre del programa"
                  required
                  value={form.hybridProgramLabel}
                  onChange={set('hybridProgramLabel')}
                />
              </div>
              <div className="w-[160px]">
                <Select etiqueta="Modalidad" opciones={MODALIDADES} value={form.modality} onChange={set('modality')} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Casilla
            etiqueta="¿El nombre del programa y el libro es igual?"
            checked={libroIgual}
            onChange={(e) => setLibroIgual(e.target.checked)}
          />

          {libroIgual && (
            <div className="flex-1 min-w-[220px]">
              <Campo etiqueta="Nombre del libro" required value={form.bookName} onChange={set('bookName')} />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Docentes o autores</p>
            <button
              type="button"
              onClick={agregarDocente}
              className="text-[13px] font-medium text-marca-600 hover:text-marca-700 transition-colors"
            >
              + Agregar docente
            </button>
          </div>

          <div className="space-y-2">
            {docentes.map((d, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <Campo
                      etiqueta="Nombre"
                      required
                      placeholder="Carlos Mendoza"
                      value={d.fullName}
                      onChange={(e) => setDocente(i, 'fullName', e.target.value)}
                    />
                  </div>
                  <div className="w-[136px] shrink-0">
                    <Campo
                      etiqueta="Inicio"
                      type="date"
                      value={d.startDate}
                      onChange={(e) => setDocente(i, 'startDate', e.target.value)}
                    />
                  </div>
                  <div className="w-[136px] shrink-0">
                    <Campo
                      etiqueta="Fin"
                      type="date"
                      value={d.endDate}
                      onChange={(e) => setDocente(i, 'endDate', e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <Campo
                      etiqueta="Tipo de contrato"
                      placeholder="Prestación de servicios"
                      value={d.contractType}
                      onChange={(e) => setDocente(i, 'contractType', e.target.value)}
                    />
                  </div>
                  {docentes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarDocente(i)}
                      aria-label="Quitar docente"
                      title="Quitar docente"
                      className="h-10 w-10 grid place-items-center rounded-lg text-slate-400
                                 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Casilla
          etiqueta="Los videos los graba el profesor (se muestran como &quot;Video tutorial&quot;)"
          checked={form.videosPorDocente}
          onChange={(e) => setForm({ ...form, videosPorDocente: e.target.checked })}
        />

        <AreaTexto
          etiqueta="Observaciones"
          rows={2}
          value={form.generalComment}
          onChange={set('generalComment')}
        />

        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Con {creditos} {creditos === 1 ? 'crédito' : 'créditos'} se generarán {creditos}{' '}
            {creditos === 1 ? 'OVA' : 'OVAs'}, {creditos} {creditos === 1 ? 'video' : 'videos'} de
            contenido, {creditos} {creditos === 1 ? 'guía' : 'guías'} y 2 infografías.
            En total {totalSteps(creditos)} pasos.
          </p>
        </div>

        <Alerta>{error}</Alerta>

        <div className="flex gap-2 justify-end pt-1">
          <Boton type="button" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear asignatura'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
