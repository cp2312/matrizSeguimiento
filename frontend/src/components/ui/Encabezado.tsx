interface Props {
  children?: React.ReactNode;
}

export function Encabezado({ children }: Props) {
  return (
    <header className="bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <img src="/logo-campus.png" alt="Matriz de seguimiento" className="h-9 w-auto shrink-0" />
        {children && <div className="flex items-center gap-1">{children}</div>}
      </div>
      <div className="h-[3px] bg-gradient-to-r from-marca-400 via-marca-600 to-marca-400" />
    </header>
  );
}