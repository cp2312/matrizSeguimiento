import { Fragment, useEffect, useRef } from 'react';
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

// Flechas para moverse entre las fichas de paso sin tocar el mouse -- Enter
// ya las abre solo, por ser <button> nativos (comportamiento del navegador).
function manejarFlechas(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const botones = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
  const actual = botones.indexOf(document.activeElement as HTMLButtonElement);
  if (actual === -1) return;
  e.preventDefault();
  const avanza = e.key === 'ArrowDown' || e.key === 'ArrowRight';
  const siguiente = avanza ? (actual + 1) % botones.length : (actual - 1 + botones.length) % botones.length;
  botones[siguiente]?.focus();
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

  // Foco automático apenas se muestra la lista -- así las flechas sirven de
  // una sin tener que tocar el mouse primero (mismo criterio que el estado
  // del paso en PanelCelda.tsx). El llamador remonta este componente por
  // apartado (ver key={apartado} en ModalApartado) para que esto corra cada
  // vez que se entra a uno distinto, no solo la primera vez.
  const contenedorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contenedorRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);

  const celdasEl = (
    <div
      ref={contenedorRef}
      onKeyDown={manejarFlechas}
      className={soloContenido ? 'flex flex-wrap gap-1.5' : 'flex gap-1.5 overflow-x-auto pb-1'}
    >
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