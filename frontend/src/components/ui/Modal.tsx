import { useEffect } from 'react';

interface Props {
  abierto: boolean;
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}

export function Modal({ abierto, titulo, subtitulo, onCerrar, children }: Props) {
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
        className="w-full max-w-md bg-white rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium text-slate-800">{titulo}</h2>
        {subtitulo && <p className="text-xs text-slate-500 mt-0.5 mb-4">{subtitulo}</p>}
        <div className={subtitulo ? '' : 'mt-4'}>{children}</div>
      </div>
    </div>
  );
}