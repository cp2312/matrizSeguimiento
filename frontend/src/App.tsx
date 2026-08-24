import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/login';
import Usuarios from './pages/Usuarios';

function Protegida({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Cargando…</div>;
  }

  return usuario ? <>{children}</> : <Navigate to="/login" replace />;
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

          <Route
            path="/"
            element={
              <Protegida>
                <Layout>
                  <p className="text-sm text-slate-500">Aquí irá el listado de programas.</p>
                </Layout>
              </Protegida>
            }
          />

          <Route
            path="/usuarios"
            element={<Protegida><SoloAdmin><Usuarios /></SoloAdmin></Protegida>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}