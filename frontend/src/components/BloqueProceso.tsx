import { CeldaProceso } from './CeldaProceso';
import { pasosVisibles } from '../lib/bloques';
import type { MatrixCell, ResolvedStep } from '@shared/types';

interface Props {
  titulo: string;
  pasos: ResolvedStep[];
  celdas: Record<string, MatrixCell>;
  seleccionado: string | null;
  onSeleccionar: (path: string) => void;
  /** oculta el título/contador y la tarjeta — para cuando el bloque ya se muestra
   *  dentro de otro contenedor (la ventana flotante de un apartado) */
  soloContenido?: boolean;
}

export function BloqueProceso({
  titulo, pasos, celdas, seleccionado, onSeleccionar, soloContenido = false,
}: Props) {
  const visibles = pasosVisibles(pasos, celdas);
  const terminados = visibles.filter((p) => celdas[p.path]?.status === 'terminado').length;

  const celdasEl = (
    <div className={soloContenido ? 'flex flex-wrap gap-1.5' : 'flex gap-1.5 overflow-x-auto pb-1'}>
      {visibles.map((p) => (
        <CeldaProceso
          key={p.path}
          paso={p.step}
          celda={celdas[p.path]}
          seleccionada={seleccionado === p.path}
          onClick={() => onSeleccionar(p.path)}
        />
      ))}
    </div>
  );

  if (soloContenido) return celdasEl;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-medium text-slate-800">{titulo}</h3>
        <span className="text-xs text-slate-400">
          {terminados} de {visibles.length}
        </span>
      </div>

      {celdasEl}
    </section>
  );
}