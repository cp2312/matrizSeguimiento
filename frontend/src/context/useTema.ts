import { createContext, useContext } from 'react';

export type Tema = 'claro' | 'oscuro';

interface Contexto {
  tema: Tema;
  alternarTema: () => void;
}

export const TemaContexto = createContext<Contexto>({ tema: 'claro', alternarTema: () => {} });

export function useTema() {
  return useContext(TemaContexto);
}