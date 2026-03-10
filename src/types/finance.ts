export interface HRCost {
  role: string;
  quantity: number;
  salary: number;
  subtotal: number;
}

export interface OperationalExpenses {
  energy: number;
  internet: number;
  pettyCash: number;
  maintenance: number;
}

export interface ChemicalCost {
  name: string;
  dose?: number;
  totalKg?: number;
  pricePerKg: number;
  monthlyCost: number;
}

export interface ProductionData {
  plantFlow?: number;
  opHours?: number;
  realM3?: number;
  volumeMonth: number;
}

export interface SustainabilityData {
  lossPercent: number;
  billableVolume: number;
  userRate: number;
  breakEvenRate: number;
  revenue: number;
  profit: number;
}

export interface FinancialTotals {
  totalChemicals: number;
  totalLabor: number;
  totalOther: number;
  grandTotal: number;
  costPerM3: number;
}

export interface FinancialProjection {
  _id?: string;
  institutionName: string;
  mode: "projection" | "analysis";
  production: ProductionData;
  humanResources: HRCost[];
  operationalExpenses: OperationalExpenses;
  chemicals: ChemicalCost[];
  sustainability: SustainabilityData;
  totals: FinancialTotals;
}
