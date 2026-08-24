interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  etiqueta: string;
  opciones: Opcion[];
}

export function Select({ etiqueta, opciones, className = '', ...props }: Props) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-600 mb-1.5">{etiqueta}</span>
      <select
        {...props}
        className={`w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm
                    outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
        ))}
      </select>
    </label>
  );
}