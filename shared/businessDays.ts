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
