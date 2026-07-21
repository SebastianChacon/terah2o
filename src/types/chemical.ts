export type ChemicalFunction = "coag" | "ph" | "helper" | "oxid";

export interface Chemical {
  id: string;
  name: string;
  func: ChemicalFunction;
  concentration: number;
  pricePerKg: number;
}

export interface DoseResult {
  dose: number;
  aforoMlMin: number;
  dailyConsKg: number;
  autonomyDays: number;
}

export interface DosificationEntry {
  product: string;
  mlMin: number;
  concentration: number;
  doseResult: number;
  autonomyDays?: number;
}

export interface ChemicalProduct {
  value: string;
  label: string;
}

export const CHEMICAL_PRODUCTS: ChemicalProduct[] = [
  { value: "PAC", label: "PAC (Policloruro de Aluminio)" },
  { value: "Sulfato de Aluminio", label: "Sulfato de Aluminio" },
  { value: "Hipoclorito de Sodio", label: "Hipoclorito de Sodio" },
  { value: "Cloro Gas", label: "Cloro Gas" },
  { value: "Floculante", label: "Polímero Floculante" },
  { value: "Regulador pH", label: "Regulador de pH" },
];

export const COAGULANT_OPTIONS = [
  { value: "Alumbre", label: "Sulfato de Aluminio" },
  { value: "PAC", label: "Policloruro (PAC)" },
  { value: "PACS", label: "Policlorosulfato (PACS)" },
  { value: "Ferrico", label: "Cloruro Férrico" },
];
