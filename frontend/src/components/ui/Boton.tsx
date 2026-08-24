interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'texto';
  forma?: 'redondeada' | 'pildora';
  ancho?: 'auto' | 'completo';
}

const VARIANTES = {
  primario:   'bg-slate-800 text-white hover:bg-slate-700',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  texto:      'bg-transparent text-slate-600 hover:bg-slate-100',
};

const FORMAS = {
  redondeada: 'rounded-lg',
  pildora:    'rounded-full',
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
      className={`h-11 px-5 text-sm font-medium transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${VARIANTES[variante]} ${FORMAS[forma]}
                  ${ancho === 'completo' ? 'w-full' : ''} ${className}`}
    />
  );
}