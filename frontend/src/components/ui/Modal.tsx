import { useEffect } from 'react';

interface Props {
  abierto: boolean;
  /** vacío ("") oculta la barra de título por completo -- para un popup
   *  chico cuyo contenido ya trae su propio encabezado (p. ej. PanelCelda) */
  titulo: string;
  subtitulo?: string;
  /** normal: max-w-md (por defecto). grande: max-w-4xl, para formularios con
   *  layout horizontal. angosto: como w-72, para un popup chico. */
  ancho?: 'normal' | 'grande' | 'angosto';
  /** contenido extra junto al título, p. ej. un botón de acción */
  accionesTitulo?: React.ReactNode;
  onCerrar: () => void;
  children: React.ReactNode;
}

const ANCHOS = {
  normal: 'w-full max-w-md',
  // Sin w-full: como es un item flex, se ajusta a su contenido (hasta el
  // tope de max-w-4xl) en vez de quedar siempre a ancho completo con
  // espacio vacío cuando el contenido (p. ej. un solo paso) es angosto.
  grande: 'max-w-4xl',
  angosto: 'w-full max-w-[18rem]',
};

export function Modal({
  abierto, titulo, subtitulo, ancho = 'normal', accionesTitulo, onCerrar, children,
}: Props) {
  useEffect(() => {
    if (!abierto) return;
    const cerrarConEsc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', cerrarConEsc);
    return () => window.removeEventListener('keydown', cerrarConEsc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 overflow-y-auto p-4"
      onClick={onCerrar}
    >
      {/* min-h-full + centrado en un wrapper aparte (en vez de centrar el
          propio contenedor con scroll) para que un modal más alto que la
          pantalla no quede con la parte de arriba inalcanzable -- crece
          desde su alto mínimo en vez de recortarse. */}
      <div className="min-h-full flex items-center justify-center">
        <div
          className={`${ANCHOS[ancho]} bg-white dark:bg-slate-900 rounded-2xl p-6`}
          onClick={(e) => e.stopPropagation()}
        >
          {titulo && (
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-slate-800 dark:text-slate-100">{titulo}</h2>
                {subtitulo && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">{subtitulo}</p>}
              </div>
              {accionesTitulo}
            </div>
          )}
          <div className={titulo && !subtitulo ? 'mt-4' : ''}>{children}</div>
        </div>
      </div>
    </div>
  );
}