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
  { role: "Ingenieria", defaultQty: 1, defaultSalary: 900 },
  { role: "Administracion", defaultQty: 1, defaultSalary: 600 },
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
