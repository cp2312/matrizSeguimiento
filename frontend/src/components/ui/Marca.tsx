interface Props {
  tamano?: 'sm' | 'md';
}

const TAMANOS = {
  sm: { logo: 'w-8 h-8', titulo: 'text-xs', sub: 'text-[10px]' },
  md: { logo: 'w-11 h-11', titulo: 'text-sm', sub: 'text-xs' },
};

export function Marca({ tamano = 'md' }: Props) {
  const t = TAMANOS[tamano];

  return (
    <div className="flex items-center gap-3">
      <img src="/logo-usta1.png" alt="" className={`${t.logo} shrink-0`} />
      <div className="leading-tight">
        <p className={`${t.titulo} font-semibold text-slate-800 tracking-tight`}>
          MATRIZ DE SEGUIMIENTO
        </p>
        <p className={`${t.sub} font-medium text-teal-600 tracking-wide`}>
          ESPACIOS ACADÉMICOS
        </p>
      </div>
    </div>
  );
}

