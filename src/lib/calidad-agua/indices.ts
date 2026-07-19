// Índices sanitarios derivados que no forman parte de la norma INEN/TULSMA
// per se, pero informan el diagnóstico técnico: estabilidad del agua (LSI) y
// riesgo combinado por nitratos/nitritos.

export interface LsiInput {
  ph?: number | null;
  temp?: number | null;
  sdt?: number | null;
  dureza?: number | null;
  alcal?: number | null;
}

export type LsiLevel = "corrosiva" | "equilibrada" | "incrustante";

export interface LsiResult {
  value: number;
  level: LsiLevel;
  label: string;
}

// Índice de saturación de Langelier (estabilidad / corrosividad en la red).
// Retorna null si faltan datos (pH, T°, SDT, dureza y alcalinidad, todos > 0).
export function computeLSI({ ph, temp, sdt, dureza, alcal }: LsiInput): LsiResult | null {
  if (ph == null || temp == null || sdt == null || sdt <= 0 || dureza == null || dureza <= 0 || alcal == null || alcal <= 0) {
    return null;
  }
  const A = (Math.log10(sdt) - 1) / 10;
  const B = -13.12 * Math.log10(temp + 273.15) + 34.55;
  const C = Math.log10(dureza) - 0.4;
  const D = Math.log10(alcal);
  const pHs = 9.3 + A + B - (C + D);
  const value = ph - pHs;

  let level: LsiLevel;
  let label: string;
  if (value < -0.5) {
    level = "corrosiva";
    label = "Agua corrosiva — riesgo de corrosión en red";
  } else if (value > 0.5) {
    level = "incrustante";
    label = "Agua incrustante — riesgo de depósitos";
  } else {
    level = "equilibrada";
    label = "Agua equilibrada (estable)";
  }
  return { value, level, label };
}

export interface NIndexResult {
  value: number;
  conforme: boolean;
}

// Suma de nitratos y nitritos (criterio INEN/OMS): [NO3]/50 + [NO2]/3 ≤ 1
export function computeNIndex(no3: number | null | undefined, no2: number | null | undefined): NIndexResult | null {
  if (no3 == null && no2 == null) return null;
  const value = (no3 || 0) / 50 + (no2 || 0) / 3;
  return { value, conforme: value <= 1 };
}
