/**
 * Modelo de predicción de turbiedad a 7 días.
 * Basado en HIDROMETEOROLOGIA.HTML líneas 440-457.
 */
export interface TurbidityPrediction {
  labels: string[];
  values: number[];
  maxNTU: number;
}

export function predictTurbidity(
  ntuBase: number,
  rainIntensity: number,
  durationDays: number,
  severityMultiplier: number
): TurbidityPrediction {
  const values: number[] = [ntuBase];
  const labels: string[] = ["Hoy"];
  let maxNTU = ntuBase;

  for (let i = 1; i <= 7; i++) {
    labels.push(`Día ${i}`);
    let nextValue: number;

    if (i <= durationDays) {
      const surge = rainIntensity * severityMultiplier * (1.2 + i * 0.2);
      nextValue = values[i - 1] + surge;
    } else {
      const decay = (values[i - 1] - ntuBase) * 0.55;
      nextValue = Math.max(ntuBase, values[i - 1] - decay);
    }

    const valFinal = Math.round(nextValue);
    values.push(valFinal);
    if (valFinal > maxNTU) maxNTU = valFinal;
  }

  return { labels, values, maxNTU };
}

/**
 * Calcula la dosis pico proyectada basada en turbiedad y tipo de coagulante.
 * Basado en HIDROMETEOROLOGIA.HTML líneas 459-464.
 */
export function calculatePeakDose(
  maxNTU: number,
  ntuBase: number,
  userAvgDose: number,
  chemType: string
): number {
  const factorMap: Record<string, number> = {
    PAC: 0.55,
    PACS: 0.45,
    Ferrico: 0.75,
    Alumbre: 1.0,
  };
  const factor = factorMap[chemType] ?? 1.0;
  const deltaNTU = maxNTU - ntuBase;

  if (maxNTU === 0) return 0;
  return Math.round((userAvgDose + Math.sqrt(deltaNTU) * 4.2 * factor) * 10) / 10;
}

/**
 * Calcula el aforo de bomba para el motor hidrometeorológico.
 * Fórmula: mlmin = (lps * 3.6 * dose) / (conc * 0.6)
 */
export function calculateMeteoFlowRate(
  lps: number,
  dose: number,
  concPct: number
): number {
  if (lps <= 0 || concPct <= 0) return 0;
  return Math.round((lps * 3.6 * dose) / (concPct * 0.6));
}

/**
 * Calcula consumo diario en kg/d para el motor hidrometeorológico.
 */
export function calculateMeteoDailyConsumption(
  lps: number,
  dose: number
): number {
  return Math.round((lps * 3.6 * 24 * dose) / 1000);
}
