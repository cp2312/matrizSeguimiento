interface Props {
  children?: React.ReactNode;   
}

export function Encabezado({ children }: Props) {
  return (
    <header className="bg-white">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Marca */}
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="" className="h-9 w-auto shrink-0" />
          <div className="h-8 w-px bg-slate-200" />
          <img src="/campus-virtual.svg" alt="Campus Virtual" className="h-7 w-auto" />
        </div>

        {/* Zona derecha */}
        {children && <div className="flex items-center gap-3">{children}</div>}

      </div>

      {/* Línea degradada */}
      <div className="h-0.5 bg-gradient-to-r from-cyan-400 via-blue-600 to-cyan-400" />
    </header>
  );
}