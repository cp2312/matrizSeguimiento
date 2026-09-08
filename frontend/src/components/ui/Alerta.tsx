interface Props {
  tipo?: 'error' | 'info';
  children: React.ReactNode;
  centrado?: boolean;
}

const TIPOS = {
  error: 'text-red-600 dark:text-red-400',
  info: 'text-slate-600 dark:text-slate-300',
};

export function Alerta({ tipo = 'error', centrado = false, children }: Props) {
  if (!children) return null;

  return (
    <p className={`text-sm ${TIPOS[tipo]} ${centrado ? 'text-center' : ''}`}>
      {children}
    </p>
  );
}