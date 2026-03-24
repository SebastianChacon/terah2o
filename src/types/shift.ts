export interface HourlyReading {
  hora: string;
  caudal?: number;
  ph?: number;
  cloro?: number;
  color?: number;
  turbiedad?: number;
  rawPh?: number;
  rawCloro?: number;
  rawColor?: number;
  rawTurbiedad?: number;
  status?: string;
}

export interface ShiftStats {
  avgFlow: number;
  volumeTurno: number;
  projection24h: number;
  compliancePercent: number;
}

export interface ShiftRecord {
  _id?: string;
  operatorName: string;
  date: string;
  operationHours: number;
  plantFlowRef?: number;
  hourlyReadings: HourlyReading[];
  dosificationEntries: {
    product: string;
    mlMin: number;
    concentration: number;
    doseResult: number;
    autonomyDays?: number;
  }[];
  stats: ShiftStats;
  notes?: string;
  aiConsultation?: string;
}

export const TIME_SLOTS = ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"];
