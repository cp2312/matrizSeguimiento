
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/login';

function Protegida({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <div className="min-h-screen grid place-items-center text-sm text-stone-500">Cargando…</div>;
  }

  return usuario ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protegida><div className="p-8">Sesión iniciada</div></Protegida>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}