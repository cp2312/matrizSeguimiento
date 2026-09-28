import { token } from './token';

/**
 * El endpoint devuelve el archivo binario directo (no JSON), así que no se
 * puede usar el helper `api` normal -- pide con fetch a mano, arma un link
 * temporal con el blob recibido y lo "clickea" solo para bajarlo.
 */
async function descargar(url: string, nombreArchivo: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.get()}` },
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new Error(cuerpo.error ?? 'No se pudo generar el Excel');
  }
  const blob = await res.blob();
  const enlaceBlob = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = enlaceBlob;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(enlaceBlob);
}

export async function descargarMatrizExcel() {
  await descargar('/api/exportar', `matriz-seguimiento-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function descargarAsignaturaExcel(subjectId: number, nombreAsignatura: string) {
  await descargar(
    `/api/subjects/${subjectId}/exportar`,
    `matriz-${nombreAsignatura}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
