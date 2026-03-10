import type { DoseResult } from "@/types/chemical";

/**
 * Calcula la dosis de un químico en mg/L.
 * Fórmula: dose = (mlMin * concPct) / (flow * 6)
 *
 * @param mlMin - Caudal de la bomba dosificadora (mL/min)
 * @param concPct - Concentración de la solución (%)
 * @param flowLps - Caudal de la planta (L/s)
 */
export function calculateDose(
  mlMin: number,
  concPct: number,
  flowLps: number
): number {
  if (flowLps <= 0 || mlMin <= 0 || concPct <= 0) return 0;
  return (mlMin * concPct) / (flowLps * 6);
}

/**
 * Calcula el consumo diario en kg.
 * Fórmula: dailyCons = (dose * flow * 3.6 * hours) / 1000
 */
export function calculateDailyConsumption(
  doseMgL: number,
  flowLps: number,
  hoursPerDay: number
): number {
  return (doseMgL * flowLps * 3.6 * hoursPerDay) / 1000;
}

/**
 * Calcula la autonomía en días.
 * Fórmula: days = stockKg / dailyConsKg
 */
export function calculateAutonomy(
  stockKg: number,
  dailyConsKg: number
): number {
  if (dailyConsKg <= 0 || stockKg <= 0) return 0;
  return stockKg / dailyConsKg;
}

/**
 * Calcula el aforo necesario de la bomba (mL/min).
 * Despejado de: dose = (mlMin * conc) / (flow * 6)
 *   => mlMin = (dose * flow * 6) / conc
 */
export function calculatePumpFlow(
  doseMgL: number,
  flowLps: number,
  concPct: number
): number {
  if (concPct <= 0) return 0;
  return (doseMgL * flowLps * 6) / concPct;
}

/**
 * Calcula resultado completo de dosificación.
 */
export function calculateFullDose(
  mlMin: number,
  concPct: number,
  flowLps: number,
  hoursPerDay: number,
  stockKg: number
): DoseResult {
  const dose = calculateDose(mlMin, concPct, flowLps);
  const aforoMlMin = mlMin;
  const dailyConsKg = calculateDailyConsumption(dose, flowLps, hoursPerDay);
  const autonomyDays = calculateAutonomy(stockKg, dailyConsKg);

  return {
    dose: Math.round(dose * 100) / 100,
    aforoMlMin,
    dailyConsKg: Math.round(dailyConsKg * 100) / 100,
    autonomyDays: Math.round(autonomyDays * 10) / 10,
  };
}
