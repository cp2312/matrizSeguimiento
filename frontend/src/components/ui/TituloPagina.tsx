interface Props {
  titulo: React.ReactNode;
  subtitulo?: string;
  volver?: React.ReactNode;
  children?: React.ReactNode;   // acciones a la derecha
}

export function TituloPagina({ titulo, subtitulo, volver, children }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        {volver && <div className="mb-1.5">{volver}</div>}
        <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">{titulo}</h1>
        {subtitulo && <p className="text-[13px] text-slate-500 mt-1">{subtitulo}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}