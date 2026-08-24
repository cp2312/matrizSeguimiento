interface Props {
  children: React.ReactNode;
  degradado?: boolean;
  className?: string;
}

export function Tarjeta({ children, degradado = false, className = '' }: Props) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {degradado && <div className="h-1.5 bg-gradient-to-r from-teal-400 to-blue-600" />}
      {children}
    </div>
  );
}