/**
 * Calcula el volumen producido en m³.
 * Formula: flow(L/s) * 3.6 = m³/h → * hours = m³ total
 */
export function calculateVolume(flowLps: number, hours: number): number {
  return flowLps * 3.6 * hours;
}

/**
 * Volumen mensual en m³ (30 dias).
 */
export function calculateMonthlyVolume(
  flowLps: number,
  hoursPerDay: number
): number {
  return calculateVolume(flowLps, hoursPerDay) * 30;
}

/**
 * Proyeccion a 24 horas en m³.
 */
export function calculateProjection24h(flowLps: number): number {
  return calculateVolume(flowLps, 24);
}

/**
 * Volumen facturable despues de perdidas tecnicas/comerciales.
 */
export function calculateBillableVolume(
  volumeMonth: number,
  lossPercent: number
): number {
  return volumeMonth * (1 - lossPercent / 100);
}
