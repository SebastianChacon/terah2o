// Parámetros y límites normativos de la Consola de Vigilancia de Calidad del
// Agua. Fuente: NTE INEN 1108:2020 (agua de salida / red de distribución) y
// TULSMA Anexo 1, Tabla 1 (agua cruda que requiere tratamiento convencional).
// Los valores numéricos son datos regulatorios — no modificar sin verificar
// contra la edición oficial vigente.

export type SamplePoint = "SALIDA" | "CRUDA" | "RED";

export type ParamKind = "micro" | "org";

export interface Param {
  k: string;
  n: string;
  u: string;
  type?: ParamKind;
  min?: number;
  max?: number;
  lsl?: number;
  usl?: number;
  spc?: boolean;
  op?: boolean;
  lim?: string;
}

export interface ParamGroup {
  g: string;
  params: Param[];
}

export const GROUPS: ParamGroup[] = [
  {
    g: "Microbiológicos",
    params: [
      { k: "coli", n: "Coliformes totales", u: "NMP/100 mL", type: "micro", lim: "< 1.1 (Ausencia)" },
      { k: "ecoli", n: "Escherichia coli", u: "NMP/100 mL", type: "micro", lim: "< 1.1 (Ausencia)" },
    ],
  },
  {
    g: "Físicos / Organolépticos",
    params: [
      { k: "turb", n: "Turbiedad", u: "UNT", max: 5, lsl: 0, usl: 5, spc: true },
      { k: "color", n: "Color verdadero", u: "UTC (Pt-Co)", max: 15 },
      { k: "olor", n: "Olor", u: "—", type: "org" },
      { k: "sabor", n: "Sabor", u: "—", type: "org" },
      { k: "temp", n: "Temperatura", u: "°C", op: true },
      { k: "cond", n: "Conductividad eléctrica", u: "µS/cm", op: true },
      { k: "sdt", n: "Sólidos disueltos totales", u: "mg/L", max: 1000 },
    ],
  },
  {
    g: "Desinfección",
    params: [
      { k: "clibre", n: "Cloro residual libre", u: "mg/L", min: 0.3, max: 1.5, lsl: 0.3, usl: 1.5, spc: true },
      { k: "ccomb", n: "Cloro combinado", u: "mg/L", op: true },
    ],
  },
  {
    g: "Inorgánicos",
    params: [
      { k: "ph", n: "pH", u: "U. pH", min: 6.5, max: 8.5, lsl: 6.5, usl: 8.5, spc: true },
      { k: "dureza", n: "Dureza total", u: "mg/L CaCO₃", max: 300, spc: true, lsl: 0, usl: 300 },
      { k: "alcal", n: "Alcalinidad total", u: "mg/L CaCO₃", op: true },
      { k: "no3", n: "Nitratos (NO₃⁻)", u: "mg/L", max: 50, spc: true, lsl: 0, usl: 50 },
      { k: "no2", n: "Nitritos (NO₂⁻)", u: "mg/L", max: 3.0 },
      { k: "fluor", n: "Fluoruros (F⁻)", u: "mg/L", max: 1.5 },
      { k: "so4", n: "Sulfatos (SO₄²⁻)", u: "mg/L", max: 250 },
    ],
  },
  {
    g: "Metales",
    params: [
      { k: "as", n: "Arsénico (As)", u: "mg/L", max: 0.01 },
      { k: "pb", n: "Plomo (Pb)", u: "mg/L", max: 0.01 },
      { k: "cd", n: "Cadmio (Cd)", u: "mg/L", max: 0.003 },
      { k: "cr", n: "Cromo total (Cr)", u: "mg/L", max: 0.05 },
      { k: "hg", n: "Mercurio (Hg)", u: "mg/L", max: 0.006 },
      { k: "fe", n: "Hierro (Fe)", u: "mg/L", max: 0.3 },
      { k: "mn", n: "Manganeso (Mn)", u: "mg/L", max: 0.4 },
      { k: "cu", n: "Cobre (Cu)", u: "mg/L", max: 2.0 },
      { k: "al", n: "Aluminio (Al)", u: "mg/L", max: 0.2 },
    ],
  },
  {
    g: "Subproductos de desinfección",
    params: [{ k: "thm", n: "Trihalometanos totales", u: "mg/L", max: 0.3 }],
  },
];

export const ALL: Param[] = GROUPS.flatMap((g) => g.params);
export const PMAP: Record<string, Param> = Object.fromEntries(ALL.map((p) => [p.k, p]));

export const POINT_LABEL: Record<SamplePoint, string> = {
  SALIDA: "Agua de Salida",
  CRUDA: "Agua Cruda",
  RED: "Red de Distribución",
};

// TULSMA Anexo 1 · Tabla 1 — criterios de calidad de aguas para consumo
// humano y doméstico que requieren TRATAMIENTO CONVENCIONAL (agua cruda /
// fuente). Aplica cuando el punto de muestreo es CRUDA.
interface CrudaLimit {
  max?: number;
  min?: number;
  lsl?: number;
  usl?: number;
  op?: boolean;
  lim?: string;
}

export const CRUDA_LIMITS: Record<string, CrudaLimit> = {
  coli: { max: 20000, lim: "≤ 20 000 NMP" },
  ecoli: { max: 2000, lim: "≤ 2 000 NMP (C. fecales)" },
  turb: { max: 100, lsl: 0, usl: 100, lim: "≤ 100" },
  color: { max: 75, lim: "≤ 75" },
  olor: { op: true, lim: "Removible por trat." },
  sabor: { op: true, lim: "Removible por trat." },
  temp: { op: true },
  cond: { op: true },
  sdt: { op: true },
  clibre: { op: true, lim: "No aplica (cruda)" },
  ccomb: { op: true, lim: "No aplica (cruda)" },
  ph: { min: 6, max: 9, lsl: 6, usl: 9, lim: "6 – 9" },
  dureza: { op: true },
  alcal: { op: true },
  no3: { max: 10, lsl: 0, usl: 10, lim: "≤ 10 (como N)" },
  no2: { max: 1.0, lim: "≤ 1.0 (como N)" },
  fluor: { op: true },
  so4: { max: 250, lsl: 0, usl: 250, lim: "≤ 250" },
  as: { max: 0.1, lim: "≤ 0.1" },
  pb: { max: 0.05, lim: "≤ 0.05" },
  cd: { max: 0.01, lim: "≤ 0.01" },
  cr: { max: 0.05, lim: "≤ 0.05 (Cr⁶⁺)" },
  hg: { max: 0.002, lim: "≤ 0.002" },
  fe: { max: 1.0, lim: "≤ 1.0" },
  mn: { op: true },
  cu: { max: 1.0, lim: "≤ 1.0" },
  al: { max: 0.2, lim: "≤ 0.2" },
  thm: { op: true },
};

interface EffectiveLimit {
  type?: ParamKind;
  min?: number;
  max?: number;
  lsl?: number;
  usl?: number;
  op?: boolean;
  lim?: string;
}

// Límites efectivos según el punto: CRUDA → TULSMA Tabla 1; SALIDA/RED → INEN 1108:2020
export function limitsFor(p: Param, point: SamplePoint): EffectiveLimit {
  if (point === "CRUDA") {
    const c = CRUDA_LIMITS[p.k] || { op: true };
    if (p.type === "micro" || p.type === "org") return { type: p.type, op: true, lim: c.lim };
    return c;
  }
  return p;
}

export function limText(p: Param, point: SamplePoint): string {
  const L = limitsFor(p, point);
  if (L.lim) return L.lim;
  if (L.op) return point === "CRUDA" ? "Referencial" : "Operativo";
  if (L.type === "org") return "No objetable";
  return L.min != null ? `${L.min} – ${L.max}` : `≤ ${L.max}`;
}

export function normName(point: SamplePoint): string {
  return point === "CRUDA" ? "TULSMA Anexo 1 · Tabla 1" : "NTE INEN 1108:2020";
}

export type EvalStatus = "ok" | "bad" | "op" | "none";

// raw: valor crudo tal como se guarda (string) — "0"/"1" para micro/org,
// numérico en texto para el resto. point default SALIDA si no se especifica.
export function evalParam(p: Param, raw: string | undefined, point: SamplePoint = "SALIDA"): EvalStatus {
  if (raw === "" || raw == null) return "none";
  const L = limitsFor(p, point);
  if (L.op) return "op";
  if (p.type === "micro" || p.type === "org") return raw === "0" ? "ok" : "bad";
  const v = parseFloat(raw);
  if (isNaN(v)) return "none";
  const okMax = L.max == null || v <= L.max;
  const okMin = L.min == null || v >= L.min;
  return okMax && okMin ? "ok" : "bad";
}
