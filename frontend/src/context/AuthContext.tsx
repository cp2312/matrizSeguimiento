import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { token } from '../lib/token';
import { AuthContexto, type Usuario } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(() => token.get() !== null);

  useEffect(() => {
    if (!token.get()) return;

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
    location.href = `${import.meta.env.BASE_URL}login`;
  }

  async function actualizarAvatar(avatar: string | null): Promise<string | null> {
    const res = await api.patch<{ ok: boolean; usuario: string | null }>('/auth/avatar', { avatar });
    setUsuario((u) => (u ? { ...u, avatar_url: res.usuario } : u));
    return res.usuario;
  }

  return (
    <AuthContexto.Provider value={{ usuario, cargando, login, logout, actualizarAvatar }}>
      {children}
    </AuthContexto.Provider>
  );
}