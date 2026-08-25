interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  variante?: 'normal' | 'pildora';
}

const ESTILOS = {
  normal:
    'h-10 px-3 rounded-lg border border-stone-300 bg-white focus:ring-stone-400',
  pildora:
    'h-11 px-4 rounded-full border border-slate-300 bg-slate-50 focus:ring-slate-400 focus:bg-white',
};

export function Campo({ etiqueta, variante = 'normal', className = '', ...props }: Props) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-600 mb-1.5">{etiqueta}</span>
      <input
        {...props}
        className={`w-full text-sm transition-colors outline-none
                    focus:ring-2 ${ESTILOS[variante]} ${className}`}
      />
    </label>
  );
}