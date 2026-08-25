interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'texto' | 'peligro';
  forma?: 'redondeada' | 'pildora';
  ancho?: 'auto' | 'completo';
}

const VARIANTES = {
  primario:   'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm',
  texto:      'bg-transparent text-slate-600 hover:bg-slate-100',
  peligro:    'bg-white text-red-600 border border-red-200 hover:bg-red-50',
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