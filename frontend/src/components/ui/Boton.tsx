interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'texto' | 'peligro';
  forma?: 'redondeada' | 'pildora';
  ancho?: 'auto' | 'completo';
}

const VARIANTES = {
  primario:   'bg-slate-900 text-white hover:bg-slate-800 shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-slate-600',
  texto:      'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  peligro:    'bg-white text-red-600 border border-red-200 hover:bg-red-50 dark:bg-slate-900 dark:border-red-800/60 dark:hover:bg-red-950/40',
};

const FORMAS = {
  redondeada: 'rounded-lg border-none',
  pildora:    'rounded-full border-none',
};

export function Boton({
  variante = 'secundario',
  forma = 'redondeada',
  ancho = 'auto',
  className = '',
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`h-10 px-4 text-[13px] font-medium transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-1
                  ${VARIANTES[variante]} ${FORMAS[forma]}
                  ${ancho === 'completo' ? 'w-full' : ''} ${className}`}
    />
  );
}