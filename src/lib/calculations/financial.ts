import type {
  HRCost,
  OperationalExpenses,
  ChemicalCost,
  FinancialTotals,
} from "@/types/finance";

/**
 * Calcula el total de costos de recursos humanos.
 */
export function calculateTotalHR(hrCosts: HRCost[]): number {
  return hrCosts.reduce((sum, item) => sum + item.subtotal, 0);
}

/**
 * Calcula el total de gastos operacionales.
 */
export function calculateTotalExpenses(expenses: OperationalExpenses): number {
  return expenses.energy + expenses.internet + expenses.pettyCash + expenses.maintenance;
}

/**
 * Calcula el total de costos quimicos.
 */
export function calculateTotalChemicals(chemicals: ChemicalCost[]): number {
  return chemicals.reduce((sum, item) => sum + item.monthlyCost, 0);
}

/**
 * Calcula el costo mensual de un quimico.
 * Modo proyeccion: dose(mg/L) * flow(L/s) * 3.6 * hours * 30 / 1000 * price
 * Modo analisis: totalKg * price
 */
export function calculateChemicalMonthlyCost(
  mode: "projection" | "analysis",
  pricePerKg: number,
  dose?: number,
  flowLps?: number,
  hoursPerDay?: number,
  totalKg?: number
): number {
  if (mode === "analysis" && totalKg !== undefined) {
    return totalKg * pricePerKg;
  }
  if (dose && flowLps && hoursPerDay) {
    const monthlyKg = (dose * flowLps * 3.6 * hoursPerDay * 30) / 1000;
    return monthlyKg * pricePerKg;
  }
  return 0;
}

/**
 * Calcula todos los totales financieros.
 */
export function calculateFinancialTotals(
  hrCosts: HRCost[],
  expenses: OperationalExpenses,
  chemicals: ChemicalCost[],
  volumeMonth: number
): FinancialTotals {
  const totalChemicals = calculateTotalChemicals(chemicals);
  const totalLabor = calculateTotalHR(hrCosts);
  const totalOther = calculateTotalExpenses(expenses);
  const grandTotal = totalChemicals + totalLabor + totalOther;
  const costPerM3 = volumeMonth > 0 ? grandTotal / volumeMonth : 0;

  return {
    totalChemicals: Math.round(totalChemicals * 100) / 100,
    totalLabor: Math.round(totalLabor * 100) / 100,
    totalOther: Math.round(totalOther * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    costPerM3: Math.round(costPerM3 * 10000) / 10000,
  };
}

/**
 * Calcula la tarifa de equilibrio (break-even).
 */
export function calculateBreakEvenRate(
  grandTotal: number,
  billableVolume: number
): number {
  if (billableVolume <= 0) return 0;
  return Math.round((grandTotal / billableVolume) * 10000) / 10000;
}

/**
 * Calcula ingresos y utilidad proyectada.
 */
export function calculateRevenue(
  billableVolume: number,
  userRate: number,
  grandTotal: number
): { revenue: number; profit: number } {
  const revenue = Math.round(billableVolume * userRate * 100) / 100;
  const profit = Math.round((revenue - grandTotal) * 100) / 100;
  return { revenue, profit };
}
