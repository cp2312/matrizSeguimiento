export function Cargando() {
  return <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;
}

export function Vacio({ mensaje, children }: { mensaje: string; children?: React.ReactNode }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">{mensaje}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}