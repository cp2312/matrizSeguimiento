interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
}

export function Casilla({ etiqueta, ...props }: Props) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <input type="checkbox" {...props} className="w-4 h-4 accent-slate-800" />
      <span className="text-sm text-slate-700">{etiqueta}</span>
    </label>
  );
}