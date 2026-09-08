interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  variante?: 'normal' | 'pildora';
}

const ESTILOS = {
  normal:
    'h-10 px-3 rounded-lg border border-stone-300 bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-stone-400',
  pildora:
    'h-11 px-4 rounded-full border border-slate-300 bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 focus:ring-slate-400 focus:bg-white dark:focus:bg-slate-900',
};

export function Campo({ etiqueta, variante = 'normal', className = '', ...props }: Props) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{etiqueta}</span>
      <input
        {...props}
        className={`w-full text-sm transition-colors outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500
                    focus:ring-2 ${ESTILOS[variante]} ${className}`}
      />
    </label>
  );
}