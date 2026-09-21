import { useState } from 'react';
import { Campo } from './Campo';

function IconoOjo({ visible }: { visible: boolean }) {
  return visible ? (
    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a19.4 19.4 0 0 1 4.22-5.94M9.9 4.24A10.87 10.87 0 0 1 12 4c7 0 10 8 10 8a19.5 19.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CampoPassword({
  etiqueta, valor, onChange, minLength, placeholder, autoFocus,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  minLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Campo
        etiqueta={etiqueta}
        type={ver ? 'text' : 'password'}
        required
        autoFocus={autoFocus}
        minLength={minLength}
        placeholder={placeholder}
        className="pr-10"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={ver}
        className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600
                   dark:hover:text-slate-200 transition-colors"
      >
        <IconoOjo visible={ver} />
      </button>
    </div>
  );
}
