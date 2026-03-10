export interface INEN1108Param {
  name: string;
  limit: number;
  unit: string;
  min?: number;
}

export interface ParamReading {
  name: string;
  raw?: number;
  treated?: number;
  limit: number;
  ok: boolean;
}

export interface ComplianceResult {
  percentage: number;
  level: "optimal" | "alert" | "critical";
  filledCount: number;
  okCount: number;
}
