interface Props {
  tipo?: 'error' | 'info';
  children: React.ReactNode;
  centrado?: boolean;
}

const TIPOS = {
  error: 'text-red-600',
  info: 'text-slate-600',
};

export function Alerta({ tipo = 'error', centrado = false, children }: Props) {
  if (!children) return null;

  return (
    <p className={`text-sm ${TIPOS[tipo]} ${centrado ? 'text-center' : ''}`}>
      {children}
    </p>
  );
}