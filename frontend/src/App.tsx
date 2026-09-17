import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import OlvidoPassword from './pages/OlvidoPassword';
import RestablecerPassword from './pages/RestablecerPassword';
import Usuarios from './pages/Usuarios';
import ListadoProgramas from './pages/ListadoProgramas';
import Programa from './pages/Programas';
import Asignatura from './pages/Asignatura';
import Configuracion from './pages/Configuracion';
import Actividad from './pages/Actividad';

function Protegida({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Cargando…</div>;
  }

  // Guarda a dónde iba (p. ej. el link de un correo) para volver ahí después de iniciar sesión
  return usuario
    ? <>{children}</>
    : <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
}

function SoloAdmin({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  return usuario?.role === 'administrador' ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/olvido-password" element={<OlvidoPassword />} />
          <Route path="/restablecer-password" element={<RestablecerPassword />} />

          <Route
            path="/"
            element={<Protegida><ListadoProgramas /></Protegida>}
          />

          <Route
            path="/programas/:id"
            element={<Protegida><Programa /></Protegida>}
          />

          <Route
            path="/asignaturas/:id"
            element={<Protegida><Asignatura /></Protegida>}
          />

          <Route
            path="/configuracion"
            element={<Protegida><Configuracion /></Protegida>}
          />

          <Route
            path="/usuarios"
            element={<Protegida><SoloAdmin><Usuarios /></SoloAdmin></Protegida>}
          />

          <Route
            path="/actividad"
            element={<Protegida><SoloAdmin><Actividad /></SoloAdmin></Protegida>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}