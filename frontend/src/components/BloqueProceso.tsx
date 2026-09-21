import { Fragment } from 'react';
import { CeldaProceso } from './CeldaProceso';
import { pasosVisibles, etiquetaPaso } from '../lib/bloques';
import { pasoQueFalta } from '@shared/pipelineTemplate';
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

  // Para un paso repetible dentro de su bloque (p. ej. los reintentos de
  // Turnitin en "Libro"), ubica cuál es el último intento que se alcanza a
  // ver -- justo después de ese va el botón para revelar el siguiente.
  const ultimoVisiblePorPaso = new Map<string, number>();
  for (const p of visibles) {
    if (p.step.repeatable && p.instance) {
      const clave = `${p.blockKey}.${p.step.key}`;
      ultimoVisiblePorPaso.set(clave, Math.max(ultimoVisiblePorPaso.get(clave) ?? 0, p.instance));
    }
  }

  const celdasEl = (
    <div className={soloContenido ? 'flex flex-wrap gap-1.5' : 'flex gap-1.5 overflow-x-auto pb-1'}>
      {visibles.map((p) => {
        const clave = p.step.repeatable ? `${p.blockKey}.${p.step.key}` : null;
        const esUltimoVisible = clave !== null && p.instance === ultimoVisiblePorPaso.get(clave);
        const siguienteInstancia = p.instance !== null ? p.instance + 1 : null;
        const puedeAgregarMas =
          esUltimoVisible && siguienteInstancia !== null && siguienteInstancia <= p.step.repeatable!.max;

        return (
          <Fragment key={p.path}>
            <CeldaProceso
              paso={p.step}
              etiqueta={etiquetaPaso(p.step, p.instance)}
              celda={celdas[p.path]}
              seleccionada={seleccionado === p.path}
              onClick={() => onSeleccionar(p.path)}
              bloqueadoPor={pasoQueFalta(visibles, p.path, celdas)}
            />
            {puedeAgregarMas && (
              <button
                type="button"
                onClick={() => onSeleccionar(`${p.blockKey}.${siguienteInstancia}.${p.step.key}`)}
                className="min-w-[104px] shrink-0 p-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700
                           text-slate-400 dark:text-slate-500 text-[11px] leading-tight text-center grid place-items-center
                           hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-white/5 hover:bg-slate-50 transition-colors"
              >
                + Otro intento: {p.step.repeatable!.itemLabel}
              </button>
            )}
          </Fragment>
        );
      })}
    </div>
  );

  if (soloContenido) return celdasEl;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">{titulo}</h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {terminados} de {visibles.length}
        </span>
      </div>

      {celdasEl}
    </section>
  );
}