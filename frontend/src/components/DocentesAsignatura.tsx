import { useState } from 'react';
import { api } from '../lib/api';
import { Boton } from './ui/Boton';
import { Alerta } from './ui/Alerta';
import type { MatrixCell, SubjectTeacher } from '@shared/types';

interface Props {
  subjectId: number;
  teachers: SubjectTeacher[];
  onCambiados: (teachers: SubjectTeacher[]) => void;
  /** si tocar los docentes terminó de completar el tipo de contrato, el backend
   *  ya marcó ese paso como terminado -- se refleja al instante, sin recargar */
  onCeldaActualizada: (celda: MatrixCell) => void;
}

/** Mismo formato que espera el PATCH (ver DocenteEntrada en backend/src/routes/subjects.ts):
 *  id ausente = docente nuevo (se inserta); presente = se actualiza ese mismo id. */
interface DocenteEntrada {
  id?: number;
  fullName: string;
  startDate: string | null;
  endDate: string | null;
  contractType: string | null;
}

/** Convierte la fila de la base al formato que espera el PATCH. El id viaja para
 *  que el backend actualice ese docente en vez de recrearlo con un id nuevo. */
function aEntrada(t: SubjectTeacher): DocenteEntrada {
  return { id: t.id, fullName: t.full_name, startDate: t.start_date, endDate: t.end_date, contractType: t.contract_type };
}

/**
 * Quién está asignado a la asignatura -- solo el nombre. Se puede agregar o
 * quitar en cualquier momento, sin esperar a saberlo todo de una vez. La
 * fecha de inicio/fin y el tipo de contrato de cada uno se llenan después,
 * desde el apartado "Tipo de contrato".
 */
export function DocentesAsignatura({ subjectId, teachers, onCambiados, onCeldaActualizada }: Props) {
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<number | null>(null);

  async function guardar(nuevaLista: DocenteEntrada[]) {
    setError('');
    setEnviando(true);
    try {
      const resultado = await api.patch<{ teachers: SubjectTeacher[]; contratoCelda: MatrixCell | null }>(
        `/subjects/${subjectId}`, { teachers: nuevaLista }
      );
      onCambiados(resultado.teachers);
      if (resultado.contratoCelda) onCeldaActualizada(resultado.contratoCelda);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    await guardar([...teachers.map(aEntrada), { id: undefined, fullName: nombreNuevo.trim(), startDate: null, endDate: null, contractType: null }]);
    setNombreNuevo('');
  }

  async function quitar(id: number) {
    await guardar(teachers.filter((t) => t.id !== id).map(aEntrada));
    setConfirmandoQuitar(null);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-sm font-medium text-slate-800 mb-2.5">Docentes asignados</p>

      <div className="space-y-1.5 mb-3">
        {teachers.length === 0 && (
          <p className="text-[12px] text-slate-400">Aún no hay docentes asignados.</p>
        )}
        {teachers.map((t) => (
          <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-md px-2.5 py-1.5 gap-2">
            {confirmandoQuitar === t.id ? (
              <>
                <span className="text-[11.5px] text-slate-500">¿Quitar a {t.full_name}?</span>
                <span className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmandoQuitar(null)}
                    className="text-[11.5px] text-slate-500 hover:text-slate-800 underline underline-offset-2"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => quitar(t.id)}
                    disabled={enviando}
                    className="text-[11.5px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {enviando ? 'Quitando…' : 'Sí, quitar'}
                  </button>
                </span>
              </>
            ) : (
              <>
                <span className="text-[13px] text-slate-700">{t.full_name}</span>
                <button
                  onClick={() => setConfirmandoQuitar(t.id)}
                  disabled={enviando}
                  aria-label={`Quitar a ${t.full_name}`}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-50 text-sm leading-none"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={agregar} className="flex gap-2">
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre del docente"
          disabled={enviando}
          className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-[13px]
                     outline-none focus:ring-2 focus:ring-slate-400"
        />
        <Boton type="submit" disabled={enviando || !nombreNuevo.trim()} className="h-9 px-3 text-[12px] shrink-0">
          + Agregar
        </Boton>
      </form>

      <Alerta>{error}</Alerta>
    </div>
  );
}
