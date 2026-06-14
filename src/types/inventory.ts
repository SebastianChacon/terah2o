export interface StockItem {
  _id?: string;
  itemId: string;
  itemName: string;
  amount: number;
  unit: string;
  minimumLevel: number;
  dailyConsumption: number;
  isCorrelated: boolean;
  lastUpdated?: string;
}

export interface StockEntry {
  productId: string;
  newAmount: number;
  isCorrelated: boolean;
}

export const DEFAULT_STOCK_ITEMS: Omit<StockItem, "_id">[] = [
  {
    itemId: "PAC",
    itemName: "PAC (Coagulante)",
    amount: 0,
    unit: "kg",
    minimumLevel: 200,
    dailyConsumption: 0,
    isCorrelated: false,
  },
  {
    itemId: "RPH",
    itemName: "RpH (Alcalinizante)",
    amount: 0,
    unit: "kg",
    minimumLevel: 150,
    dailyConsumption: 0,
    isCorrelated: false,
  },
  {
    itemId: "HIPO",
    itemName: "Hipoclorito",
    amount: 0,
    unit: "kg",
    minimumLevel: 30,
    dailyConsumption: 0,
    isCorrelated: false,
  },
  {
    itemId: "AYUDANTE",
    itemName: "Polimero Ayudante",
    amount: 0,
    unit: "kg",
    minimumLevel: 10,
    dailyConsumption: 0,
    isCorrelated: false,
  },
];
