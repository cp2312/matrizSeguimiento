import { token } from './token';

/**
 * El endpoint devuelve el archivo binario directo (no JSON), así que no se
 * puede usar el helper `api` normal -- pide con fetch a mano, arma un link
 * temporal con el blob recibido y lo "clickea" solo para bajarlo.
 */
export async function descargarMatrizExcel() {
  const res = await fetch('/api/exportar', {
    headers: { Authorization: `Bearer ${token.get()}` },
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new Error(cuerpo.error ?? 'No se pudo generar el Excel');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `matriz-seguimiento-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
