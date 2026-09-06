/** Quita tildes y pasa a minúsculas, para que la búsqueda no dependa de escribirlas */
export function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
