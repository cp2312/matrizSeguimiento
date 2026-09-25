/**
 * Fecha de hoy ('YYYY-MM-DD'), en la zona horaria local de quien la pide (el
 * navegador en el frontend, el servidor en el backend). No usar
 * toISOString() directo: en zonas al oeste de UTC, al anochecer ya
 * devolvería la fecha del día siguiente.
 */
export function hoyISO(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/**
 * Suma días hábiles (lunes a viernes) a una fecha 'YYYY-MM-DD'. No descuenta
 * festivos -- si hace falta un calendario de festivos, se agrega acá más
 * adelante sin tocar a quien llama a esta función (ver StepDef.autoDueDate).
 */
export function sumarDiasHabiles(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00`);
  let restantes = dias;

  while (restantes > 0) {
    fecha.setDate(fecha.getDate() + 1);
    const diaSemana = fecha.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) restantes--;
  }

  return fecha.toISOString().slice(0, 10);
}
