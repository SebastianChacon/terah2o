// Control estadístico de proceso (SPC) — carta de individuos/rango móvil
// (Shewhart, ±3σ) e índices de capacidad Cp/Cpk. Lógica pura, sin React,
// consumida por la pestaña "Control Estadístico" de la Consola de Calidad
// del Agua.

export interface SpcPoint {
  /** Etiqueta del eje X (código de muestra o fecha) */
  label: string;
  value: number;
}

export interface SpcLimits {
  usl?: number;
  lsl?: number;
}

export interface SpcResult {
  mean: number;
  sigma: number;
  ucl: number;
  lcl: number;
  cp: number | null;
  cpk: number | null;
  interp: string;
  signals: string[];
  /** true si el punto en ese índice está fuera de ±3σ */
  outOfControl: boolean[];
}

function avg(a: number[]): number {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

// series debe venir ordenada cronológicamente y tener al menos 2 puntos —
// el llamador (UI) decide qué mostrar cuando hay menos de 2.
export function computeSpc(series: SpcPoint[], limits: SpcLimits): SpcResult {
  const vals = series.map((s) => s.value);
  const mean = avg(vals);
  const mr: number[] = [];
  for (let i = 1; i < vals.length; i++) mr.push(Math.abs(vals[i] - vals[i - 1]));
  const mrBar = avg(mr);
  const sigma = mrBar / 1.128;
  const ucl = mean + 2.66 * mrBar;
  const lcl = mean - 2.66 * mrBar;

  const usl = limits.usl;
  const lsl = limits.lsl ?? 0;

  let cp: number | null = null;
  let cpk: number | null = null;
  if (sigma > 0 && usl != null) {
    cp = (usl - lsl) / (6 * sigma);
    const cpu = (usl - mean) / (3 * sigma);
    const cpl = (mean - lsl) / (3 * sigma);
    cpk = Math.min(cpu, cpl);
  }

  let interp: string;
  if (cpk == null) {
    interp = "No se pudo calcular capacidad (σ = 0 o sin límite definido).";
  } else if (cpk >= 1.33) {
    interp = `Proceso CAPAZ (Cpk ${cpk.toFixed(2)} ≥ 1.33): cumple la norma aplicable con margen. Mantener control rutinario.`;
  } else if (cpk >= 1.0) {
    interp = `Capacidad MARGINAL (Cpk ${cpk.toFixed(2)}): cumple pero con poco margen. Reducir variabilidad del proceso de tratamiento.`;
  } else {
    interp = `Proceso NO CAPAZ (Cpk ${cpk.toFixed(2)} < 1.0): riesgo alto de incumplir el límite. Requiere acción correctiva sobre la operación.`;
  }

  const outOfControl = vals.map((v) => v > ucl || v < lcl);
  const signals: string[] = [];
  series.forEach((s, i) => {
    if (outOfControl[i]) signals.push(`Punto ${i + 1} (${s.value}) fuera de ±3σ`);
  });
  // racha de 7+ puntos a un lado de la media
  let run = 1;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] > mean === vals[i - 1] > mean) {
      run++;
      if (run >= 7) {
        signals.push("Racha de 7+ puntos a un lado de la media");
        break;
      }
    } else {
      run = 1;
    }
  }

  return { mean, sigma, ucl, lcl, cp, cpk, interp, signals, outOfControl };
}
