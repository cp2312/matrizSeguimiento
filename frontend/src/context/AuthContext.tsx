import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { token } from '../lib/token';

export interface Usuario {
  id: number;
  full_name: string;
  initials: string;
  role: 'usuario' | 'administrador';
}

interface Contexto {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContexto = createContext<Contexto>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token.get()) return setCargando(false);

    api.get<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(() => token.clear())
      .finally(() => setCargando(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; expiresIn: number; usuario: Usuario }>(
      '/auth/login', { email, password }
    );
    token.set(res.token);
    token.setExpiry(res.expiresIn);
    setUsuario(res.usuario);
  }

  function logout() {
    token.clear();
    setUsuario(null);
    location.href = '/login';
  }

  return (
    <AuthContexto.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContexto.Provider>
  );
}

export const useAuth = () => useContext(AuthContexto);
