import type { INEN1108Param } from "@/types/water-params";

export const INEN_1108_PARAMS: INEN1108Param[] = [
  { name: "Turbiedad", limit: 5, unit: "UNT" },
  { name: "Color Verdadero", limit: 15, unit: "UPC" },
  { name: "pH", limit: 8.5, unit: "U. pH", min: 6.5 },
  { name: "Alcalinidad", limit: 200, unit: "mg/L" },
  { name: "Cloro Residual", limit: 1.5, unit: "mg/L", min: 0.3 },
  { name: "Hierro (Fe)", limit: 0.3, unit: "mg/L" },
  { name: "Manganeso (Mn)", limit: 0.1, unit: "mg/L" },
  { name: "Cobre (Cu)", limit: 2.0, unit: "mg/L" },
  { name: "Sulfatos (SO4)", limit: 250, unit: "mg/L" },
  { name: "Fosfatos (PO4)", limit: 0.5, unit: "mg/L" },
  { name: "Nitritos (NO2)", limit: 3.0, unit: "mg/L" },
  { name: "Nitratos (NO3)", limit: 50.0, unit: "mg/L" },
];

export const IVA_RATE = 0.15;

// Contacto / soporte — número único de la empresa usado en toda la plataforma.
// CONTACT_PHONE_DISPLAY: formato legible para mostrar al usuario.
// WHATSAPP_NUMBER: formato wa.me (solo dígitos, con código de país, sin "+" ni símbolos).
export const CONTACT_PHONE_DISPLAY = "+1 (608) 448-9126";
export const WHATSAPP_NUMBER = "16084489126";
export const WHATSAPP_DEFAULT_MESSAGE =
  "Hola TeraH2O, me gustaría más información sobre la plataforma.";

// Enlace listo para usar (incluye mensaje pre-llenado).
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_DEFAULT_MESSAGE,
)}`;

export const HR_ROLES = [
  { role: "Operadores", defaultQty: 2, defaultSalary: 450 },
  { role: "Ingeniería", defaultQty: 1, defaultSalary: 900 },
  { role: "Administración", defaultQty: 1, defaultSalary: 600 },
  { role: "Contabilidad", defaultQty: 1, defaultSalary: 500 },
];

export const MOCK_INVENTORY: Record<string, number> = {
  PAC: 500,
  "Sulfato de Aluminio": 300,
  "Hipoclorito de Sodio": 100,
  "Cloro Gas": 50,
  "Cal Hidratada": 200,
  "Ayudante de Floc": 25,
};
