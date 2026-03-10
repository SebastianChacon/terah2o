export type PlantSize = "Pequeña" | "Mediana" | "Grande";

export interface PlantSettings {
  _id?: string;
  location: string;
  plantSize: string;
  chemical: string;
  avgDose: number;
  avgConc: number;
  lastFetch?: string;
}
