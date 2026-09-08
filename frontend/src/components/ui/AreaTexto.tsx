interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string;
}

export function AreaTexto({ etiqueta, className = '', ...props }: Props) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{etiqueta}</span>
      <textarea
        {...props}
        className={`w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 text-sm resize-y
                    outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
      />
    </label>
  );
}