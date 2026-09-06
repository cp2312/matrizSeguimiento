import { Link, useLocation } from 'react-router-dom';
import { Encabezado } from './ui/Encabezado';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
  /** 'completo' quita el ancho máximo para pantallas densas (tableros, matrices) */
  ancho?: 'normal' | 'completo';
}

export function Layout({ children, ancho = 'normal' }: Props) {
  const { usuario, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <Encabezado>
        <nav className="flex items-center gap-1 mr-3">
          <EnlaceNav a="/" activo={pathname === '/'}>Programas</EnlaceNav>
          {usuario?.role === 'administrador' && (
            <EnlaceNav a="/usuarios" activo={pathname.startsWith('/usuarios')}>
              Usuarios
            </EnlaceNav>
          )}
        </nav>

        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block leading-tight">
            <p className="text-[13px] font-medium text-slate-700">{usuario?.full_name}</p>
            <p className="text-[11px] text-slate-400">
              {usuario?.role === 'administrador' ? 'Administrador' : 'Usuario'}
            </p>
          </div>

          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-marca-500 to-marca-700
                          grid place-items-center shrink-0">
            <span className="text-white text-[11px] font-semibold tracking-wide">
              {usuario?.initials}
            </span>
          </div>

          <button
            onClick={logout}
            title="Cerrar sesión"
            className="w-9 h-9 grid place-items-center rounded-lg text-slate-400
                       hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </Encabezado>

      <main className={`mx-auto px-6 py-8 ${ancho === 'completo' ? 'max-w-[1800px]' : 'max-w-7xl'}`}>
        {children}
      </main>
    </div>
  );
}

function EnlaceNav({ a, activo, children }: { a: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={a}
      className={`px-3 h-9 inline-flex items-center rounded-lg text-[13px] font-medium
                  transition-colors ${
        activo
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
      }`}
    >
      {children}
    </Link>
  );
}