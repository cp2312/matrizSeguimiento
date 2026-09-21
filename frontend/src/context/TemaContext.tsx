import { useEffect, useState } from 'react';
import { TemaContexto, type Tema } from './useTema';

const CLAVE = 'matriz-tema';

function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'claro';
  const guardado = localStorage.getItem(CLAVE);
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', tema === 'oscuro');
    root.style.colorScheme = tema;
    localStorage.setItem(CLAVE, tema);
  }, [tema]);

  function alternarTema() {
    setTema((t) => (t === 'claro' ? 'oscuro' : 'claro'));
  }

  return (
    <TemaContexto.Provider value={{ tema, alternarTema }}>
      {children}
    </TemaContexto.Provider>
  );
}