import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { BotonConfirmar } from './ui/BotonConfirmar';
import { Alerta } from './ui/Alerta';
import { Cargando } from './ui/Estado';

interface FilaBackup {
  id: number;
  createdAt: string;
  creadoPor: string | null;
  celdasCount: number;
  teachersCount: number;
}

function fechaHoraLegible(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Copias de seguridad que "Reiniciar matriz" va dejando (una por cada vez
 * que se reinició esa asignatura) -- solo para administradores. Restaurar
 * reemplaza las celdas y docentes actuales por los de esa copia.
 */
export function ModalCopiasSeguridad({
  abierto, subjectId, onCerrar, onRestaurado,
}: {
  abierto: boolean;
  subjectId: number;
  onCerrar: () => void;
  onRestaurado: () => void;
}) {
  const { datos: backups, cargando, error } = useFetch<FilaBackup[]>(
    abierto ? `/subjects/${subjectId}/backups` : null
  );

  async function restaurar(backupId: number) {
    await api.post(`/subjects/${subjectId}/backups/${backupId}/restaurar`, {});
    onRestaurado();
    onCerrar();
  }

  return (
    <Modal abierto={abierto} titulo="Copias de seguridad" onCerrar={onCerrar}>
      <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-4">
        Cada vez que se reinicia la matriz de esta asignatura, queda acá una copia de cómo estaba justo antes.
      </p>

      <Alerta>{error}</Alerta>

      {cargando ? (
        <Cargando />
      ) : !backups || backups.length === 0 ? (
        <p className="text-[13px] text-slate-400 dark:text-slate-500 py-4 text-center">
          Todavía no hay copias de seguridad para esta asignatura.
        </p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {backups.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                  {fechaHoraLegible(b.createdAt)}
                </p>
                <p className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate">
                  {b.celdasCount} {b.celdasCount === 1 ? 'celda' : 'celdas'} · {b.teachersCount} {b.teachersCount === 1 ? 'docente' : 'docentes'}
                  {b.creadoPor && ` · reiniciada por ${b.creadoPor}`}
                </p>
              </div>
              <BotonConfirmar
                etiqueta="Restaurar"
                etiquetaConfirmar="Sí, restaurar"
                titulo="Restaurar copia de seguridad"
                mensaje={`¿Restaurar esta copia del ${fechaHoraLegible(b.createdAt)}? Reemplaza todo el avance y los docentes actuales de la asignatura.`}
                variante="peligro"
                onConfirmar={() => restaurar(b.id)}
                className="h-8 px-3 text-[12px] shrink-0"
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
