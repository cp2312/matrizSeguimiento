interface Props {
  children?: React.ReactNode;
  /** acciones a la derecha de la barra (avatar, tema, salir) */
  acciones?: React.ReactNode;
}

export function Encabezado({ children, acciones }: Props) {
  return (
    <header className="sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="mt-3 rounded-2xl h-14 flex items-center gap-2 px-3
                        bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10
                        shadow-lg shadow-slate-900/5 backdrop-blur-xl
                        supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-white/[0.06]">
          <img src="/logo-campus.png" alt="Matriz de seguimiento" className="h-9 w-auto shrink-0 px-1" />
          <nav className="flex-1 flex items-center justify-center gap-1 min-w-0">
            {children}
          </nav>
          {acciones && <div className="flex items-center gap-1 shrink-0">{acciones}</div>}
        </div>
      </div>
    </header>
  );
}