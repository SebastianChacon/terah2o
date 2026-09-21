import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_PHONE_DISPLAY, WHATSAPP_LINK } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Presentación institucional | TERAH2O",
  description:
    "Brochure institucional TeraH2O 2026: módulos del sistema, análisis de calidad del agua, impacto ambiental, beneficios, seguridad y modalidades de suscripción.",
};

/**
 * Presentación institucional — versión web del brochure PDF 2026.
 *
 * El PDF sigue disponible en /TERAH2O-Brochure.pdf (mismo contenido) para
 * compartir por correo o imprimir. Esta ruta es pública (ver src/proxy.ts):
 * es material comercial, no un módulo operativo.
 */

// ---------------------------------------------------------------- datos

const SECCIONES = [
  { id: "diagnostico", n: "01", label: "Diagnóstico" },
  { id: "solucion", n: "02", label: "Solución" },
  { id: "calidad", n: "03", label: "Calidad" },
  { id: "impacto", n: "04", label: "Impacto" },
  { id: "beneficios", n: "05", label: "Beneficios" },
  { id: "evaluacion", n: "06", label: "Evaluación" },
  { id: "seguridad", n: "07", label: "Seguridad" },
  { id: "suscripcion", n: "08", label: "Suscripción" },
];

const KPIS_PORTADA = [
  { value: "15%", label: "Optimización química*" },
  { value: "100%", label: "Trazabilidad operativa" },
  { value: "24/7", label: "Control y cumplimiento" },
  { value: "7d", label: "Predicción IA climática" },
];

const DIAGNOSTICO = [
  {
    title: "Dosificación dinámica basada en la calidad real del agua",
    body: "Turbiedad, pH y carga orgánica cambian cada día. Un motor estequiométrico que acompaña esos cambios en tiempo real permite ajustar la dosis óptima con base en los datos del agua — no en estimaciones fijas.",
    stat: "Dosis",
    statLabel: "Calculada en tiempo real",
  },
  {
    title: "Cumplimiento normativo registrado y auditable",
    body: "Cada turno de operación queda registrado y validado automáticamente contra INEN 1108. Ante cualquier auditoría o revisión regulatoria, la evidencia técnica está disponible de inmediato — clara, ordenada y trazable.",
    stat: "100%",
    statLabel: "Trazabilidad por turno",
  },
  {
    title: "El conocimiento del equipo, respaldado por el sistema",
    body: "TeraH2O convierte el conocimiento técnico especializado en un proceso documentado y reproducible. Cualquier operador de turno actúa con el respaldo del sistema — manteniendo la calidad operativa que el equipo ha construido.",
    stat: "Equipo",
    statLabel: "Respaldado por datos",
  },
  {
    title: "Planificación de insumos con proyección de consumo real",
    body: "Con datos históricos de dosificación y predicción del agua, el sistema proyecta el consumo de insumos con antelación. Esto permite planificar compras con datos sólidos, negociar con proveedores desde una posición informada y mantener la autonomía química bajo control.",
    stat: "Stock",
    statLabel: "Proyectado con datos",
  },
  {
    title: "Registros inalterables como respaldo institucional permanente",
    body: "Cada dato operativo queda escrito en base de datos inalterable con marca de tiempo. El historial de operación de la planta es un activo institucional — disponible, organizado y listo para cualquier revisión técnica o regulatoria.",
    stat: "∞",
    statLabel: "Historial trazable",
  },
];

const MODULOS = [
  {
    title: "Consola Operativa PTAP",
    body: "Motor estequiométrico dinámico · Dosis óptima diaria de coagulante y cloro · Matriz digital de jarras · Control de turno · Bitácora inalterable · Gestión de inventario en tiempo real.",
    tag: "Núcleo",
  },
  {
    title: "Análisis de Calidad del Agua",
    body: "Evaluación completa del agua producida contra INEN 1108 · Semáforo de cumplimiento por parámetro · Porcentaje global de conformidad · Perfil extendido para ingenieros con 30+ parámetros.",
    tag: "Agua segura",
  },
  {
    title: "Motor IA Hidrometeorológico",
    body: "Anticipa variación de turbiedad con 1 a 7 días de anticipación · Dosificación preventiva antes del evento climático · Proyección de consumo kg/día · Potenciado por API Gemini (Google).",
    tag: "IA · 7 días",
  },
  {
    title: "Academia Tera · Simulador PTAP Multinorma",
    body: "Webinars técnicos · Módulos e-learning · Capacitaciones en planta · Certificaciones · Simulador acceso libre (Ecuador, Colombia, Perú) · Comunidad activa en 5+ países.",
    tag: "Libre",
  },
];

const CONSOLA_DEMO = [
  { value: "25", label: "Turb. NTU" },
  { value: "7.1", label: "pH crudo" },
  { value: "18.5", label: "Coagulante mg/L" },
  { value: "3.10", label: "Desinfectante mg/L" },
  { value: "✓ INEN", label: "Conformidad" },
];

const PARAMETROS = [
  { nombre: "Turbiedad", valor: "0.4 NTU", limite: "≤ 1 NTU", estado: "ok" },
  { nombre: "Color aparente", valor: "3 UC", limite: "≤ 15 UC", estado: "ok" },
  { nombre: "pH", valor: "7.2", limite: "6.5 – 8.5", estado: "ok" },
  {
    nombre: "Agente Desinfectante Residual Libre",
    valor: "0.5 mg/L",
    limite: "0.3 – 1.5",
    estado: "ok",
  },
  { nombre: "E. Coli", valor: "0 UFC/100mL", limite: "0", estado: "ok" },
  { nombre: "Hierro Total", valor: "0.12 mg/L", limite: "≤ 0.3", estado: "ok" },
  {
    nombre: "Aluminio Residual",
    valor: "0.19 mg/L",
    limite: "≤ 0.2",
    estado: "limite",
  },
  {
    nombre: "Coliformes Totales",
    valor: "0 NMP/100mL",
    limite: "0",
    estado: "ok",
  },
] as const;

const CADENA_CO2 = [
  {
    title: "Dosis óptima",
    body: "Menos coagulante · Menos agente desinfectante",
  },
  { title: "Menor producción", body: "Industria química" },
  { title: "Menos emisiones", body: "CO₂ equivalente" },
  { title: "Planeta más limpio", body: "Impacto verificable" },
];

const IMPACTO = [
  {
    title: "Reducción de emisiones CO₂ equivalente",
    body: "Cada kg de coagulante no usado evita su fabricación industrial de alto consumo energético. Una planta de 50 L/s puede reducir entre 4 y 8 toneladas de CO₂eq por año.",
    stat: "−8t",
    statLabel: "CO₂eq/año · ref. 50 L/s",
  },
  {
    title: "Menor carga química al cuerpo hídrico receptor",
    body: "Dosificación óptima equivale a menor residuo de coagulante en lodos y efluentes. Menos impacto en el ecosistema acuático aguas abajo de la planta.",
    stat: "−30%",
    statLabel: "Residuos en lodos",
  },
  {
    title: "Gestión preventiva del riesgo climático",
    body: "El Motor IA anticipa eventos de alta turbiedad por lluvia con 1–7 días de anticipación. Permite preparar la planta antes del evento, evitando sobredosificaciones de emergencia.",
    stat: "−7d",
    statLabel: "Anticipa el evento",
  },
  {
    title: "Agua segura: preservación de la vida humana",
    body: "Cada turno validado automáticamente garantiza agua apta en la red de distribución. Cero margen de error. La tecnología al servicio de la vida.",
    stat: "100%",
    statLabel: "Conformidad normativa",
  },
];

const KPIS_IMPACTO = [
  { value: "−26%", label: "Reducción insumos" },
  { value: "−30%", label: "Lodos residuales" },
  { value: "−8t", label: "CO₂eq/año" },
  { value: "100%", label: "Agua apta consumo" },
];

const BENEFICIOS = [
  {
    title: "Optimización del uso de productos químicos",
    body: "En plantas con sobredosificación activa, la dosis dinámica puede reducir el consumo de agentes coagulantes hasta un 15%. En plantas que operan por debajo de la dosis óptima, el sistema garantiza cumplimiento normativo. El beneficio varía según la operación de cada planta.",
    stat: "Hasta 15%",
    statLabel: "Optimización química*",
  },
  {
    title: "Eliminación del riesgo regulatorio",
    body: "Cada turno validado automáticamente contra INEN 1108. Ante una auditoría sanitaria, evidencia técnica irrefutable generada sin esfuerzo adicional. Sin riesgo de sanciones.",
    stat: "100%",
    statLabel: "Trazabilidad normativa",
  },
  {
    title: "Control total de autonomía de insumos",
    body: "Proyecciones de stock y costo por m³ en tiempo real. Elimina compras de emergencia. Negocie con proveedores desde datos, no desde urgencia.",
    stat: "0",
    statLabel: "Compras de emergencia",
  },
  {
    title: "Modernización sin inversión en hardware",
    body: "100% cloud. Sin servidores, sin sensores, sin instalaciones. La modernización institucional ocurre sin trauma tecnológico ni CAPEX.",
    stat: "$0",
    statLabel: "Inversión hardware",
  },
  {
    title: "Academia Tera · Formación continua incluida",
    body: "Adoptar TeraH2O incluye acceso a Academia Tera — plataforma de formación continua especializada en agua potable. Webinars técnicos, módulos e-learning y certificaciones para que los profesionales del sector desarrollen sus capacidades y operen con mayor precisión y confianza.",
    stat: "+100",
    statLabel: "Profesionales formados",
  },
];

const PASOS = [
  {
    title: "Análisis financiero gratuito con datos reales de la planta",
    body: "Con los parámetros reales de su operación — caudal, productos químicos empleados y dosis actuales — realizamos una simulación técnica y financiera en vivo. Sin costo. Sin compromiso de contratación.",
  },
  {
    title: "Diagnóstico de potencial de optimización",
    body: "Identificamos oportunidades de mejora en el uso de insumos, cumplimiento normativo y gestión operativa. Entregamos recomendaciones concretas — independientemente de si el cliente contrata o no el sistema.",
  },
  {
    title: "Propuesta personalizada de costo / beneficio",
    body: "Con base en el diagnóstico, presentamos el plan de suscripción con el costo definido en función del caudal y los productos empleados. El cliente conoce el valor que recibirá antes de firmar cualquier acuerdo.",
  },
  {
    title: "25 días de prueba completa — sin pago, sin compromiso",
    body: "Acceso completo a todos los módulos del sistema. Al finalizar el período, se entrega un informe técnico con los resultados reales de operación obtenidos durante la prueba. El cliente decide con evidencia en mano.",
  },
  {
    title: "Implementación acompañada · Soporte y capacitación incluidos",
    body: "Capacitación operativa al equipo de la planta, soporte técnico continuo y acceso a Academia Tera incluidos en todos los planes. No hay costos ocultos. No está solo después de contratar.",
  },
];

const SEGURIDAD = [
  {
    title: "Cifrado AES-256 · Datos en reposo",
    body: "Toda la información almacenada está cifrada con AES-256 — el mismo estándar utilizado por instituciones financieras y gobiernos. Ningún dato se almacena en texto plano.",
    stat: "AES-256",
  },
  {
    title: "Protocolo SSL/TLS 1.3 · Datos en tránsito",
    body: "Toda comunicación entre el usuario y los servidores viaja cifrada bajo TLS 1.3. Conexión verificada con certificado digital. Imposible interceptar datos en tránsito.",
    stat: "TLS 1.3",
  },
  {
    title: "Google Cloud · Infraestructura certificada",
    body: "Infraestructura alojada en Google Cloud con certificación ISO 27001 y SOC 2. Alta disponibilidad, backups automáticos y replicación geográfica. Sus datos nunca se pierden.",
    stat: "ISO 27001",
  },
  {
    title: "Acceso por roles · Autenticación segura",
    body: "Roles diferenciados para operador, supervisor e ingeniero. Cada usuario accede únicamente a la información que le corresponde. Doble factor disponible.",
    stat: "RBAC",
  },
  {
    title: "Registros inmutables · Trazabilidad garantizada",
    body: "Cada registro operativo se escribe con marca de tiempo inmutable. Ningún dato puede modificarse o eliminarse — garantía de integridad para auditorías regulatorias.",
    stat: "Inmutable",
  },
];

const COMPARATIVA = [
  {
    criterio: "Cálculo de dosis",
    tradicional: "Estimación fija por experiencia",
    tera: "Motor estequiométrico dinámico",
  },
  {
    criterio: "Cumplimiento INEN",
    tradicional: "Manual, sin trazabilidad",
    tera: "Validación automática por turno",
  },
  {
    criterio: "Calidad del agua",
    tradicional: "Sin semáforo de parámetros",
    tera: "Semáforo + % global + 30+ param.",
  },
  {
    criterio: "Predicción climática",
    tradicional: "Sin capacidad predictiva",
    tera: "IA · pronóstico 1–7 días",
  },
  {
    criterio: "Seguridad de datos",
    tradicional: "Excel / papel sin cifrado",
    tera: "AES-256 + TLS 1.3 + Inmutable",
  },
  {
    criterio: "Impacto ambiental",
    tradicional: "Sin medición CO₂",
    tera: "Reducción verificable CO₂eq",
  },
];

const PLANES = [
  {
    nombre: "Mensual",
    nota: "",
    features: ["Acceso completo", "Soporte técnico", "Actualizaciones"],
  },
  {
    nombre: "Semestral",
    nota: "Mayor flexibilidad",
    features: ["Todo lo mensual", "Academia incluida", "Capacitación en planta"],
  },
  {
    nombre: "Anual",
    nota: "Mejor valor",
    features: [
      "Todo lo semestral",
      "Informe anual ejecutivo",
      "Prioridad en soporte",
    ],
  },
];

const RESPALDO = [
  { nombre: "SENADI Ecuador", detalle: "PI Registrada" },
  { nombre: "SERCOP", detalle: "Proveedor público" },
  { nombre: "Google Cloud", detalle: "AES-256 · ISO 27001" },
  { nombre: "INEN 1108", detalle: "Norma integrada" },
];

// ------------------------------------------------------------ componentes

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.62rem] tracking-[0.28em] uppercase text-blue-400/80">
      {children}
    </span>
  );
}

function Section({
  id,
  n,
  kicker,
  title,
  lead,
  children,
}: {
  id: string;
  n: string;
  kicker: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 border-t border-white/[0.07] px-6 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-baseline gap-3">
          <span className="font-mono text-[0.62rem] tracking-[0.28em] text-white/30">
            {n}
          </span>
          <Kicker>{kicker}</Kicker>
        </div>
        <h2 className="max-w-3xl text-[clamp(1.5rem,3.4vw,2.2rem)] font-semibold leading-[1.25] tracking-tight">
          {title}
        </h2>
        {lead && (
          <p className="mt-4 max-w-3xl text-[0.95rem] font-light leading-[1.8] text-white/65">
            {lead}
          </p>
        )}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function NumberedItem({
  index,
  title,
  body,
  stat,
  statLabel,
}: {
  index: number;
  title: string;
  body: string;
  stat?: string;
  statLabel?: string;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
      <span className="font-mono text-[0.7rem] tracking-[0.2em] text-blue-400/70">
        {String(index).padStart(2, "0")}
      </span>
      <div className="flex-1">
        <h3 className="text-[0.98rem] font-semibold leading-snug text-white">
          {title}
        </h3>
        <p className="mt-2 text-[0.88rem] font-light leading-[1.75] text-white/60">
          {body}
        </p>
      </div>
      {stat && (
        <div className="shrink-0 border-t border-white/[0.08] pt-3 sm:w-40 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
          <div className="text-[1.15rem] font-semibold text-blue-400">
            {stat}
          </div>
          {statLabel && (
            <div className="mt-1 font-mono text-[0.58rem] uppercase leading-relaxed tracking-[0.16em] text-white/40">
              {statLabel}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StatStrip({
  items,
}: {
  items: { value: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] px-4 py-5 text-center"
        >
          <div className="text-[1.5rem] font-semibold tracking-tight text-blue-400">
            {s.value}
          </div>
          <div className="mt-1.5 font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.18em] text-white/45">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 rounded-[4px] border-l-2 border-blue-500/60 bg-blue-500/[0.06] px-5 py-4 text-[0.88rem] font-light leading-[1.8] text-white/75">
      {children}
    </p>
  );
}

// ------------------------------------------------------------------ página

export default function PresentacionPage() {
  return (
    <div className="min-h-screen bg-[#05051a] text-white">
      {/* Barra superior */}
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#05051a]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="text-[0.95rem] font-bold tracking-[0.04em]">
            <span className="text-white">TERA</span>
            <span className="text-blue-500">H2O</span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="/TERAH2O-Brochure.pdf"
              download
              className="inline-flex items-center gap-2 rounded-[3px] border border-blue-500/40 bg-blue-500/[0.08] px-3.5 py-2 font-mono text-[0.6rem] font-medium uppercase tracking-[0.18em] text-blue-300 transition-all hover:border-blue-400 hover:bg-blue-500/[0.16] hover:text-blue-200"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              PDF
            </a>
          </div>
        </div>
      </header>

      {/* Portada */}
      <section className="relative overflow-hidden px-6 pb-16 pt-16 sm:pt-24">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.13)_0%,transparent_65%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="text-[clamp(2.4rem,7vw,4.2rem)] font-bold leading-none tracking-[0.03em]">
            <span className="text-white">TERA</span>
            <span className="text-blue-500">H2O</span>
          </div>
          <p className="mt-3 flex items-center gap-2 font-mono text-[0.68rem] tracking-[0.3em] text-white/45">
            <span className="text-[0.6rem] text-blue-500">✦</span>
            INTELIGENCIA OPERATIVA
          </p>

          <p className="mt-8 max-w-2xl text-[1rem] font-light leading-[1.85] text-white/70">
            Infraestructura digital para la dirección técnica y operativa de
            sistemas de agua potable. Control, soporte especializado y formación
            continua bajo un enfoque de eficiencia y excelencia operativa.
          </p>

          <div className="mt-10">
            <StatStrip items={KPIS_PORTADA} />
          </div>

          <p className="mt-6 font-mono text-[0.58rem] uppercase leading-relaxed tracking-[0.16em] text-white/35">
            INEN 1108 · Res. 2115 Colombia · DS 031-2010 Perú · PI Registrada
            SENADI · Proveedor SERCOP
          </p>

          {/* Índice de secciones */}
          <nav
            aria-label="Secciones de la presentación"
            className="mt-10 flex flex-wrap gap-2"
          >
            {SECCIONES.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-2 rounded-[3px] border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/70 transition-all hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-blue-300"
              >
                <span className="text-white/35">{s.n}</span>
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Qué es / propósito */}
      <section className="border-t border-white/[0.07] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-3xl text-[clamp(1.5rem,3.4vw,2.2rem)] font-semibold leading-[1.25] tracking-tight">
            Tecnología diseñada para la gestión del recurso más valioso: el
            agua.
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6">
              <Kicker>¿Qué es TeraH2O?</Kicker>
              <p className="mt-3 text-[0.9rem] font-light leading-[1.8] text-white/65">
                TeraH2O es una plataforma de{" "}
                <b className="font-semibold text-white/90">
                  Inteligencia Operativa
                </b>{" "}
                diseñada exclusivamente para Plantas de Tratamiento de Agua
                Potable. Integra en un solo sistema el cálculo dinámico de
                dosificación química, el control de calidad del agua, la
                predicción climática con Inteligencia Artificial y la formación
                continua del equipo técnico —{" "}
                <b className="font-semibold text-white/90">
                  todo desde cualquier dispositivo, sin hardware, sin inversión
                  inicial.
                </b>
              </p>
            </div>

            <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6">
              <Kicker>Nuestro propósito</Kicker>
              <p className="mt-3 text-[0.9rem] font-light leading-[1.8] text-white/65">
                Creemos que el acceso a tecnología de gestión hídrica{" "}
                <b className="font-semibold text-white/90">
                  no puede ser un privilegio económico.
                </b>{" "}
                Cada planta, sin importar su tamaño, merece operar con datos
                precisos, cumplimiento normativo garantizado y la certeza de que
                el agua que produce es segura para cada persona que la recibe.{" "}
                <b className="font-semibold text-white/90">
                  Esa es la razón por la que existe TeraH2O.
                </b>
              </p>
            </div>
          </div>

          <p className="mt-8 font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.16em] text-white/40">
            Desarrollado desde Cuenca, Ecuador · Activo en 5+ países · +100
            profesionales formados
          </p>
        </div>
      </section>

      {/* 01 — Diagnóstico */}
      <Section
        id="diagnostico"
        n="01"
        kicker="El diagnóstico · Toma de decisiones con datos trazables"
        title="Con datos precisos, cada decisión es más segura."
        lead="Los ingenieros e ingenieras que operan plantas de tratamiento enfrentan diariamente condiciones cambiantes del agua. TeraH2O es la herramienta que respalda ese trabajo con datos trazables, cálculo dinámico y registro continuo — para que cada decisión operativa tenga el soporte técnico que merece."
      >
        <ul className="flex flex-col gap-3">
          {DIAGNOSTICO.map((item, i) => (
            <NumberedItem key={item.title} index={i + 1} {...item} />
          ))}
        </ul>
        <Callout>
          TeraH2O no reemplaza el criterio del ingeniero — lo potencia. Es la
          herramienta que traduce años de experiencia operativa en datos
          trazables, cálculos verificables y registros que respaldan cada
          decisión técnica tomada en planta.
        </Callout>
      </Section>

      {/* 02 — Solución */}
      <Section
        id="solucion"
        n="02"
        kicker="La solución · Sistema integrado · Cuatro módulos"
        title="Una planta que piensa. Un sistema que decide."
        lead="TeraH2O es la primera arquitectura de Inteligencia Operativa diseñada exclusivamente para PTAP. Cuatro módulos integrados que operan como un sistema único — no como herramientas separadas."
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {MODULOS.map((m, i) => (
            <li
              key={m.title}
              className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.7rem] tracking-[0.2em] text-blue-400/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="rounded-[2px] border border-blue-500/30 bg-blue-500/[0.08] px-2 py-1 font-mono text-[0.53rem] uppercase tracking-[0.16em] text-blue-300">
                  {m.tag}
                </span>
              </div>
              <h3 className="mt-3 text-[0.98rem] font-semibold text-white">
                {m.title}
              </h3>
              <p className="mt-2 text-[0.85rem] font-light leading-[1.75] text-white/60">
                {m.body}
              </p>
            </li>
          ))}
        </ul>

        {/* Consola — muestra */}
        <div className="mt-8 rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-white/45">
              Consola operativa · Turno activo · 06:00 – 14:00
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-emerald-400">
              <span aria-hidden="true">●</span> Operativo
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {CONSOLA_DEMO.map((m) => (
              <div key={m.label}>
                <div className="text-[1.05rem] font-semibold text-white">
                  {m.value}
                </div>
                <div className="mt-1 font-mono text-[0.53rem] uppercase tracking-[0.16em] text-white/40">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.07] pt-4 text-[0.82rem] text-white/60">
            <div className="flex items-center justify-between gap-4">
              <span>Reducción vs. dosis fija anterior</span>
              <span className="font-mono font-semibold text-blue-400">−28%</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Cumplimiento global INEN 1108</span>
              <span className="font-mono font-semibold text-emerald-400">
                96.8%
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* 03 — Calidad */}
      <Section
        id="calidad"
        n="03"
        kicker="Análisis de calidad · Agua segura"
        title="El agua que sale de su planta: verificada."
        lead="El módulo de Análisis de Calidad evalúa el agua producida contra la norma INEN 1108. Un semáforo de cumplimiento por parámetro y un porcentaje global de conformidad — el operador y el ingeniero saben en tiempo real si el agua que va a la red es apta."
      >
        <div className="grid gap-4 md:grid-cols-[1fr_1.6fr]">
          <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6">
            <Kicker>Cumplimiento global INEN 1108</Kicker>
            <div className="mt-4 text-[2.6rem] font-semibold leading-none tracking-tight text-emerald-400">
              96.8%
            </div>
            <p className="mt-3 font-mono text-[0.58rem] uppercase leading-relaxed tracking-[0.16em] text-white/45">
              23 de 24 parámetros dentro del límite normativo
            </p>
            <ul className="mt-6 flex flex-col gap-2 text-[0.8rem] text-white/60">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Cumple
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                En límite
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                No cumple
              </li>
            </ul>
          </div>

          <div className="overflow-x-auto rounded-[4px] border border-white/[0.08] bg-white/[0.03]">
            <table className="w-full min-w-[26rem] text-left text-[0.82rem]">
              <thead>
                <tr className="border-b border-white/[0.08] font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white/40">
                  <th className="px-4 py-3 font-medium">Parámetro</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Límite</th>
                  <th className="px-4 py-3 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {PARAMETROS.map((p) => (
                  <tr
                    key={p.nombre}
                    className="border-b border-white/[0.05] last:border-0"
                  >
                    <td className="px-4 py-3 text-white/75">{p.nombre}</td>
                    <td className="px-4 py-3 font-mono text-white/60">
                      {p.valor}
                    </td>
                    <td className="px-4 py-3 font-mono text-white/45">
                      {p.limite}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        p.estado === "ok" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {p.estado === "ok" ? "✓" : "⚠"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6">
          <Kicker>Perfil extendido · Ingeniero de planta</Kicker>
          <p className="mt-3 text-[0.88rem] font-light leading-[1.8] text-white/65">
            Para pruebas continuas con análisis completo, el ingeniero accede a
            más de 30 parámetros físicoquímicos y microbiológicos, histórico
            trazable, reportes mensuales automáticos y exportación para entes
            reguladores.
          </p>
        </div>

        <Callout>
          Agua segura no es solo un indicador técnico. Es la garantía de salud
          para cada persona en la red de distribución. Cada parámetro en verde
          es una vida protegida.
        </Callout>
      </Section>

      {/* 04 — Impacto */}
      <Section
        id="impacto"
        n="04"
        kicker="Impacto ambiental · Innovación sostenible"
        title="Menos químicos. Agua más limpia. Planeta más sano."
        lead="La optimización química de TeraH2O no solo ahorra dinero: reduce la huella ambiental de toda la cadena de tratamiento, desde la producción de insumos hasta la descarga al ambiente receptor."
      >
        <div className="mb-8">
          <Kicker>Cadena de reducción de emisiones CO₂</Kicker>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {CADENA_CO2.map((c, i) => (
              <div
                key={c.title}
                className="relative rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-4"
              >
                <div className="text-[0.88rem] font-semibold text-white">
                  {c.title}
                </div>
                <div className="mt-1.5 text-[0.78rem] font-light leading-relaxed text-white/55">
                  {c.body}
                </div>
                {i < CADENA_CO2.length - 1 && (
                  <span
                    className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-blue-400/60 sm:block"
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {IMPACTO.map((item, i) => (
            <NumberedItem key={item.title} index={i + 1} {...item} />
          ))}
        </ul>

        <div className="mt-8">
          <StatStrip items={KPIS_IMPACTO} />
        </div>
      </Section>

      {/* 05 — Beneficios */}
      <Section
        id="beneficios"
        n="05"
        kicker="Beneficios · Costo / beneficio"
        title="Resultados verificables. Retorno documentado."
      >
        <ul className="flex flex-col gap-3">
          {BENEFICIOS.map((item, i) => (
            <NumberedItem key={item.title} index={i + 1} {...item} />
          ))}
        </ul>

        <Callout>
          <b className="font-semibold text-white/90">Nota importante:</b> No
          toda planta experimentará beneficios económicos directos. Plantas que
          ya operan cerca de la dosis óptima obtienen mayor valor en
          trazabilidad, cumplimiento normativo, seguridad del agua y gestión
          operativa. El sistema tiene valor en todos los escenarios.
        </Callout>

        <div className="mt-4 flex flex-col gap-4 rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <Kicker>Modelo costo / beneficio</Kicker>
            <p className="mt-3 text-[0.88rem] font-light leading-[1.8] text-white/65">
              Los beneficios económicos dependen de las condiciones operativas
              de cada planta. El costo de suscripción se define siempre tras un
              análisis financiero gratuito, bajo el principio de costo/beneficio
              para el usuario. No se contrata sin certeza de valor.
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="text-[1.6rem] font-semibold text-blue-400">
              ROI &gt;10×
            </div>
            <div className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white/40">
              Primer año*
            </div>
          </div>
        </div>
      </Section>

      {/* 06 — Evaluación previa */}
      <Section
        id="evaluacion"
        n="06"
        kicker="Evaluación previa · Proceso de acceso"
        title="Primero evaluamos. Luego implementamos."
        lead="Para el uso de la plataforma TeraH2O, cada planta es evaluada técnicamente antes de activar el sistema. El costo de la plataforma y el modelo de implementación se definen siempre en función de los resultados de este diagnóstico. No se contrata sin certeza de valor."
      >
        <ul className="flex flex-col gap-3">
          {PASOS.map((p, i) => (
            <NumberedItem key={p.title} index={i + 1} {...p} />
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-4 rounded-[4px] border border-blue-500/25 bg-blue-500/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <Kicker>Comience hoy</Kicker>
            <p className="mt-3 text-[0.88rem] font-light leading-[1.8] text-white/70">
              El análisis financiero es gratuito y sin compromiso. Con los datos
              reales de su planta calculamos el potencial de optimización y
              definimos una propuesta justa. El primer paso no tiene costo.
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="text-[0.95rem] font-semibold text-white">
              Sin costo · Sin compromiso
            </div>
            <div className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-blue-300">
              25 días de prueba completa
            </div>
          </div>
        </div>
      </Section>

      {/* 07 — Seguridad */}
      <Section
        id="seguridad"
        n="07"
        kicker="Seguridad y arquitectura"
        title="Sus datos operativos: protegidos y soberanos."
        lead="Los datos de su planta están protegidos bajo estándares de seguridad empresarial. Nadie accede a su información sin su autorización. Cada registro es inmutable y auditable."
      >
        <ul className="flex flex-col gap-3">
          {SEGURIDAD.map((item, i) => (
            <NumberedItem
              key={item.title}
              index={i + 1}
              title={item.title}
              body={item.body}
              stat={item.stat}
            />
          ))}
        </ul>

        <div className="mt-8">
          <Kicker>TeraH2O vs. método tradicional</Kicker>
          <div className="mt-4 overflow-x-auto rounded-[4px] border border-white/[0.08] bg-white/[0.03]">
            <table className="w-full min-w-[34rem] text-left text-[0.82rem]">
              <thead>
                <tr className="border-b border-white/[0.08] font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white/40">
                  <th className="px-4 py-3 font-medium">Criterio</th>
                  <th className="px-4 py-3 font-medium">Método tradicional</th>
                  <th className="px-4 py-3 font-medium text-blue-300">
                    TeraH2O
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARATIVA.map((c) => (
                  <tr
                    key={c.criterio}
                    className="border-b border-white/[0.05] last:border-0"
                  >
                    <td className="px-4 py-3 text-white/75">{c.criterio}</td>
                    <td className="px-4 py-3 text-white/45">{c.tradicional}</td>
                    <td className="px-4 py-3 text-blue-300/90">{c.tera}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* 08 — Suscripción y contacto */}
      <Section
        id="suscripcion"
        n="08"
        kicker="Suscripción y contacto · Análisis financiero gratuito"
        title="Suscripción basada en costo / beneficio real."
        lead="El costo de suscripción se define siempre después de un análisis financiero gratuito. Evaluamos caudal, productos empleados y operación actual para fijar un precio proporcional al beneficio real que el sistema aporta a su planta."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANES.map((p) => (
            <div
              key={p.nombre}
              className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6"
            >
              <div className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white/50">
                {p.nombre}
              </div>
              <div className="mt-3 text-[1.05rem] font-semibold text-white">
                Según evaluación
              </div>
              {p.nota && (
                <div className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-blue-300">
                  {p.nota}
                </div>
              )}
              <ul className="mt-5 flex flex-col gap-2 text-[0.84rem] font-light text-white/60">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Callout>
          El acceso a tecnología de gestión hídrica no puede ser un privilegio
          económico. El costo de TeraH2O está diseñado para ser proporcional al
          beneficio que genera — verificado antes de contratar.
        </Callout>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6">
            <Kicker>Contacto comercial y técnico</Kicker>
            <ul className="mt-4 flex flex-col gap-2 text-[0.86rem] text-white/70">
              <li>
                <a href="tel:+593960342771" className="hover:text-blue-300">
                  +593 960 342 771
                </a>
                <span className="mx-1.5 text-white/30">·</span>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-300"
                >
                  {CONTACT_PHONE_DISPLAY}
                </a>
                <span className="mx-1.5 text-white/30">·</span>
                <a href="tel:075730108" className="hover:text-blue-300">
                  07 573 0108
                </a>
              </li>
              <li>
                <a
                  href="mailto:teraserviciosprofesionales@outlook.com"
                  className="text-blue-400 hover:underline"
                >
                  teraserviciosprofesionales@outlook.com
                </a>
              </li>
              <li className="font-light text-white/55">
                Av. Remigio Crespo, Torre Ceiva, Piso 3-304
                <br />
                Cuenca, Ecuador · Latinoamérica
              </li>
            </ul>
          </div>

          <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6">
            <Kicker>Respaldo institucional</Kicker>
            <ul className="mt-4 flex flex-col gap-2.5">
              {RESPALDO.map((r) => (
                <li
                  key={r.nombre}
                  className="flex items-baseline justify-between gap-4 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-[0.86rem] text-white/75">
                    {r.nombre}
                  </span>
                  <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white/40">
                    {r.detalle}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.16em] text-white/40">
              Reconocimiento · 500 Mejores Proyectos América Latina y el Caribe ·
              Premios Verdes 2026 · Agua Dulce
            </p>
          </div>
        </div>
      </Section>

      {/* Cierre */}
      <section className="border-t border-white/[0.07] px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <blockquote className="text-[clamp(1.1rem,2.6vw,1.5rem)] font-light leading-[1.6] text-white/85">
            «Donde hay datos trazables, hay decisiones más certeras. Donde hay
            decisiones certeras, hay agua segura.»
          </blockquote>
          <p className="mt-5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white/45">
            Ing. José Alfredo Quintero Sáez · Fundador, Servicios Profesionales
            Tera
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a
              href="/TERAH2O-Brochure.pdf"
              download
              className="inline-flex items-center gap-2 rounded-[3px] border border-blue-500/40 bg-blue-500/[0.08] px-5 py-2.5 font-mono text-[0.68rem] font-medium uppercase tracking-[0.2em] text-blue-300 transition-all hover:border-blue-400 hover:bg-blue-500/[0.16] hover:text-blue-200"
            >
              Descargar en PDF
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-[3px] border border-white/[0.12] bg-white/5 px-5 py-2.5 font-mono text-[0.68rem] font-medium uppercase tracking-[0.2em] text-white transition-all hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-blue-400"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-4 py-6 text-center">
        <p className="mx-auto mb-4 max-w-2xl text-[0.72rem] font-light leading-relaxed text-white/35">
          * Indicador de referencia bajo escenarios de sobredosificación. Los
          resultados varían según las condiciones operativas de cada planta.
        </p>
        <p className="font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.16em] text-white/35">
          © 2026 Servicios Profesionales Tera · Todos los derechos reservados ·
          PI Registrada SENADI · Proveedor SERCOP · Google Cloud ISO 27001 ·
          Cuenca, Ecuador
        </p>
      </footer>
    </div>
  );
}
