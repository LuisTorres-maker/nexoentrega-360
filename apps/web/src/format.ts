// La API trabaja en UTC; la interfaz muestra hora de Bogota (UTC-5).
const ZONA = 'America/Bogota';

export function fechaBogota(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** ISO UTC -> valor para <input type="datetime-local"> en hora de Bogota (YYYY-MM-DDTHH:mm). */
export function aInputLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (hora de Bogota) -> ISO UTC. */
export function desdeInputLocal(valor: string): string {
  return new Date(`${valor}:00-05:00`).toISOString();
}
