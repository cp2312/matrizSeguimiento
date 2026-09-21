import { createContext, useContext } from 'react';

export interface Usuario {
  id: number;
  full_name: string;
  initials: string;
  role: 'usuario' | 'administrador';
  avatar_url: string | null;
}

interface Contexto {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Actualiza la foto de perfil del usuario en el estado (y devuelve la nueva URL o null) */
  actualizarAvatar: (avatar: string | null) => Promise<string | null>;
}

export const AuthContexto = createContext<Contexto>(null!);

export function useAuth() {
  return useContext(AuthContexto);
}