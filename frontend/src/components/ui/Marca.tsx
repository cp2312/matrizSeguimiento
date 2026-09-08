interface Props {
  tamano?: 'sm' | 'md';
}

const TAMANOS = {
  sm: { logo: 'w-32', titulo: 'text-xs', sub: 'text-[10px]' },
  md: { logo: 'w-44', titulo: 'text-sm', sub: 'text-xs' },
};

export function Marca({ tamano = 'md' }: Props) {
  const t = TAMANOS[tamano];

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <img
        src="https://campusvirtual.santototunja.edu.co/assets/Copia-de-FInal-Logo-campusprueba2-2-1-scaled-CAabIrYv.png"
        alt=""
        className={`${t.logo} h-auto object-contain dark:brightness-0 dark:invert`}
      />
      <div className="leading-tight">
        <p className={`${t.titulo} font-semibold text-slate-800 dark:text-slate-100 tracking-tight`}>
          MATRIZ DE SEGUIMIENTO
        </p>
        <p className={`${t.sub} font-medium text-teal-600 dark:text-teal-400 tracking-wide`}>
          ESPACIOS ACADÉMICOS
        </p>
      </div>
    </div>
  );
}

