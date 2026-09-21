import { Link, useLocation } from 'react-router-dom';
import { Encabezado } from './ui/Encabezado';
import { Avatar } from './ui/Avatar';
import { useAuth } from '../context/useAuth';
import { useTema } from '../context/useTema';

interface Props {
  children: React.ReactNode;
  /** 'completo' quita el ancho máximo para pantallas densas (tableros, matrices) */
  ancho?: 'normal' | 'completo';
}

export function Layout({ children, ancho = 'normal' }: Props) {
  const { usuario, logout } = useAuth();
  const { tema, alternarTema } = useTema();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Encabezado
        acciones={
          <div className="flex items-center gap-1">
            <Link
              to="/configuracion"
              title="Configuración de perfil"
              className="hidden md:flex items-center justify-end gap-2 mr-1 leading-tight rounded-full
                         px-2 py-1 -mx-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10 group"
            >
              <div className="text-right">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{usuario?.full_name}</p>
                <p className="text-[11px] text-slate-400">
                  {usuario?.role === 'administrador' ? 'Administrador' : 'Usuario'}
                </p>
              </div>
              <Avatar
                nombre={usuario?.full_name ?? ''}
                iniciales={usuario?.initials ?? ''}
                avatarUrl={usuario?.avatar_url}
                className="transition-transform group-hover:scale-110"
              />
            </Link>

            <Link
              to="/configuracion"
              title="Configuración de perfil"
              className="md:hidden w-9 h-9 grid place-items-center rounded-full text-slate-500 dark:text-slate-300
                         hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10
                         hover:scale-110 active:scale-95 transition-all duration-150"
            >
              <Avatar tamano="sm" nombre={usuario?.full_name ?? ''} iniciales={usuario?.initials ?? ''} avatarUrl={usuario?.avatar_url} />
            </Link>

            <Accion onClick={alternarTema} titulo={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}>
              {tema === 'oscuro' ? (
                <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </Accion>

            <Accion onClick={logout} titulo="Cerrar sesión">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </Accion>
          </div>
        }
      >
        <nav className="inline-flex items-center gap-1">
          <EnlaceNav a="/" activo={pathname === '/'}>Programas</EnlaceNav>
          {usuario?.role === 'administrador' && (
            <>
              <EnlaceNav a="/usuarios" activo={pathname.startsWith('/usuarios')}>
                Usuarios
              </EnlaceNav>
              <EnlaceNav a="/actividad" activo={pathname.startsWith('/actividad')}>
                Actividad
              </EnlaceNav>
            </>
          )}
        </nav>
      </Encabezado>

      <main className={`px-6 pt-6 pb-10 ${ancho === 'completo' ? 'max-w-[1800px]' : 'max-w-7xl'} mx-auto`}>
        {children}
      </main>
    </div>
  );
}

function Accion({ onClick, titulo, children }: { onClick: () => void; titulo: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      className="w-9 h-9 grid place-items-center rounded-full text-slate-500 dark:text-slate-300
                 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10
                 hover:scale-110 active:scale-95 transition-all duration-150"
    >
      {children}
    </button>
  );
}

function EnlaceNav({ a, activo, children }: { a: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={a}
      className={`px-3.5 h-8 inline-flex items-center rounded-full text-[13px] font-medium
                  transition-all duration-150 ${
        activo
          ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 dark:bg-white dark:text-slate-900 dark:shadow-black/30'
          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 hover:scale-[1.04] active:scale-[0.97]'
      }`}
    >
      {children}
    </Link>
  );
}
