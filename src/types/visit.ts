import type { ParamReading } from "./water-params";

export interface QuoteItem {
  prod: string;
  qty: string;
  price: string;
  total: string;
}

export interface CommercialData {
  proveedor?: string;
  marketProducts: string[];
  adquisicion?: string;
  contratacion?: string;
  fechaCompra?: string;
  comentarios?: string;
  cotizacion: QuoteItem[];
  totalQuote?: string;
}

export interface DosageRecord {
  product: string;
  mgL: string;
  days: string;
}

export interface VisitRecord {
  _id?: string;
  idInforme: string;
  timestamp?: string;
  tipoCliente: "CARTERA" | "POTENCIAL";
  org: string;
  telefono: string;
  correo?: string;
  autoridad?: string;
  tecnicoPlanta?: string;
  provincia?: string;
  canton?: string;
  caudal?: number;
  horasOperacion?: number;
  compliance?: number;
  observaciones?: string;
  params: ParamReading[];
  dosages: DosageRecord[];
  comercial: CommercialData;
}
