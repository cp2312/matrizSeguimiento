import { useEffect } from 'react';

interface Props {
  abierto: boolean;
  titulo: string;
  subtitulo?: string;
  /** normal: max-w-md (por defecto). grande: max-w-4xl, para formularios con layout horizontal */
  ancho?: 'normal' | 'grande';
  /** contenido extra junto al título, p. ej. un botón de acción */
  accionesTitulo?: React.ReactNode;
  onCerrar: () => void;
  children: React.ReactNode;
}

const ANCHOS = {
  normal: 'max-w-md',
  grande: 'max-w-4xl',
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
      className="fixed inset-0 z-50 bg-black/45 flex items-start justify-center p-4 pt-16 overflow-y-auto"
      onClick={onCerrar}
    >
      <div
        className={`w-full ${ANCHOS[ancho]} bg-white dark:bg-slate-900 rounded-2xl p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-slate-800 dark:text-slate-100">{titulo}</h2>
            {subtitulo && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">{subtitulo}</p>}
          </div>
          {accionesTitulo}
        </div>
        <div className={subtitulo ? '' : 'mt-4'}>{children}</div>
      </div>
    </div>
  );
}