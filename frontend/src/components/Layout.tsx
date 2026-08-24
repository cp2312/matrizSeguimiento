import { Encabezado } from './ui/Encabezado';
import { useAuth } from '../context/AuthContext';
import { Boton } from './ui/Boton';

interface Props {
  children: React.ReactNode;
}

export function Layout({ children }: Props) {
  const { usuario, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <Encabezado>
        <span className="text-sm text-slate-600 hidden sm:inline">
          {usuario?.full_name}
        </span>
        <span className="w-8 h-8 rounded-full bg-slate-800 grid place-items-center shrink-0">
          <span className="text-white text-[11px] font-medium">{usuario?.initials}</span>
        </span>
        <Boton variante="texto" onClick={logout} className="h-9 px-3">
          Salir
        </Boton>
      </Encabezado>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}