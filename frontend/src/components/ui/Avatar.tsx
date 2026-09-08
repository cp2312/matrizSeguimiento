interface Props {
  nombre: string;
  iniciales: string;
  avatarUrl?: string | null;
  tamano?: 'sm' | 'md' | 'lg' | 'xl';
}

const TAMANOS = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-9 h-9 text-[11px]',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-24 h-24 text-2xl',
};

const FUENTE_INICIALES = {
  sm: 'text-[10px]',
  md: 'text-[11px]',
  lg: 'text-sm',
  xl: 'text-2xl',
};

/**
 * Foto de perfil si el usuario subió una; si no, un círculo con sus iniciales.
 */
export function Avatar({ nombre, iniciales, avatarUrl, tamano = 'md' }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nombre}
        className={`${TAMANOS[tamano]} rounded-full object-cover bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200/60 dark:ring-white/10 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${TAMANOS[tamano]} rounded-full bg-marca-500 dark:bg-marca-600 grid place-items-center ring-1 ring-white/20 shrink-0`}
    >
      <span className={`text-white font-semibold tracking-wide ${FUENTE_INICIALES[tamano]}`}>
        {iniciales}
      </span>
    </div>
  );
}