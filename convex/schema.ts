import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // ── Auth tables (generadas por @convex-dev/auth) ──────────────────────────
  ...authTables,

  // ── Tablas existentes (sin cambios excepto organizationId opcional) ────────

  visitas: defineTable({
    idInforme: v.string(),
    tipoCliente: v.union(v.literal("CARTERA"), v.literal("POTENCIAL")),
    org: v.string(),
    telefono: v.string(),
    correo: v.optional(v.string()),
    autoridad: v.optional(v.string()),
    tecnicoPlanta: v.optional(v.string()),
    provincia: v.optional(v.string()),
    canton: v.optional(v.string()),
    caudal: v.optional(v.number()),
    horasOperacion: v.optional(v.number()),
    compliance: v.optional(v.number()),
    observaciones: v.optional(v.string()),
    params: v.array(
      v.object({
        name: v.string(),
        raw: v.optional(v.number()),
        treated: v.optional(v.number()),
        limit: v.number(),
        ok: v.boolean(),
      })
    ),
    dosages: v.array(
      v.object({
        product: v.string(),
        mgL: v.string(),
        days: v.string(),
      })
    ),
    comercial: v.object({
      proveedor: v.optional(v.string()),
      marketProducts: v.array(v.string()),
      adquisicion: v.optional(v.string()),
      contratacion: v.optional(v.string()),
      fechaCompra: v.optional(v.string()),
      comentarios: v.optional(v.string()),
      cotizacion: v.array(
        v.object({
          prod: v.string(),
          qty: v.string(),
          price: v.string(),
          total: v.string(),
        })
      ),
      totalQuote: v.optional(v.string()),
    }),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_tipo", ["tipoCliente"])
    .index("by_organizationId", ["organizationId"]),

  plantSettings: defineTable({
    location: v.string(),
    plantSize: v.string(),
    chemical: v.string(),
    avgDose: v.number(),
    avgConc: v.number(),
    lastFetch: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  }).index("by_organizationId", ["organizationId"]),

  inventoryItems: defineTable({
    itemId: v.string(),
    itemName: v.string(),
    amount: v.number(),
    unit: v.string(),
    minimumLevel: v.number(),
    dailyConsumption: v.number(),
    isCorrelated: v.boolean(),
    lastUpdated: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_itemId", ["itemId"])
    .index("by_organizationId", ["organizationId"]),

  shiftRecords: defineTable({
    operatorName: v.string(),
    date: v.string(),
    operationHours: v.number(),
    plantFlowRef: v.optional(v.number()),
    hourlyReadings: v.array(
      v.object({
        hora: v.string(),
        caudal: v.optional(v.number()),
        ph: v.optional(v.number()),
        cloro: v.optional(v.number()),
        color: v.optional(v.number()),
        turbiedad: v.optional(v.number()),
        rawPh: v.optional(v.number()),
        rawCloro: v.optional(v.number()),
        rawColor: v.optional(v.number()),
        rawTurbiedad: v.optional(v.number()),
        status: v.optional(v.string()),
      })
    ),
    dosificationEntries: v.array(
      v.object({
        product: v.string(),
        mlMin: v.number(),
        concentration: v.number(),
        doseResult: v.number(),
        autonomyDays: v.optional(v.number()),
      })
    ),
    stats: v.object({
      avgFlow: v.number(),
      volumeTurno: v.number(),
      projection24h: v.number(),
      compliancePercent: v.number(),
    }),
    notes: v.optional(v.string()),
    aiConsultation: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_date", ["date"])
    .index("by_organizationId", ["organizationId"]),

  financialProjections: defineTable({
    institutionName: v.string(),
    mode: v.union(v.literal("projection"), v.literal("analysis")),
    period: v.optional(v.string()),             // "YYYY-MM"
    analisisProyectado: v.optional(v.number()), // grandTotal from linked projection
    analisisReal: v.optional(v.number()),        // grandTotal from linked real analysis
    cumplimiento: v.optional(v.number()),        // ((real-proy)/proy)*100
    production: v.object({
      plantFlow: v.optional(v.number()),
      opHours: v.optional(v.number()),
      realM3: v.optional(v.number()),
      volumeMonth: v.number(),
    }),
    humanResources: v.array(
      v.object({
        role: v.string(),
        quantity: v.number(),
        salary: v.number(),
        subtotal: v.number(),
      })
    ),
    operationalExpenses: v.object({
      energy: v.number(),
      internet: v.number(),
      pettyCash: v.number(),
      maintenance: v.number(),
    }),
    chemicals: v.array(
      v.object({
        name: v.string(),
        dose: v.optional(v.number()),
        totalKg: v.optional(v.number()),
        pricePerKg: v.number(),
        monthlyCost: v.number(),
      })
    ),
    sustainability: v.object({
      lossPercent: v.number(),
      billableVolume: v.number(),
      userRate: v.number(),
      breakEvenRate: v.number(),
      revenue: v.number(),
      profit: v.number(),
    }),
    totals: v.object({
      totalChemicals: v.number(),
      totalLabor: v.number(),
      totalOther: v.number(),
      grandTotal: v.number(),
      costPerM3: v.number(),
    }),
    organizationId: v.optional(v.id("organizations")),
  }).index("by_organizationId", ["organizationId"]),

  jarTestSessions: defineTable({
    organizationName: v.string(),
    samplePoint: v.string(),
    date: v.string(),
    plantFlow: v.number(),
    opHours: v.number(),
    rawWaterParams: v.array(
      v.object({
        label: v.string(),
        value: v.number(),
      })
    ),
    chemicals: v.array(
      v.object({
        name: v.string(),
        func: v.string(),
        concentration: v.number(),
        pricePerKg: v.number(),
      })
    ),
    observations: v.optional(v.string()),
    aiDiagnosis: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  }).index("by_organizationId", ["organizationId"]),

  bitacoraEntries: defineTable({
    date: v.string(),
    source: v.string(),
    category: v.string(),
    summary: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_date", ["date"])
    .index("by_category", ["category"])
    .index("by_organizationId", ["organizationId"]),

  // ── Nuevas tablas de negocio ───────────────────────────────────────────────

  // users extiende la tabla de authTables — todos los campos opcionales para
  // que @convex-dev/auth pueda insertar {email:"..."} sin error de validación.
  // upsertCurrentUser() completa role, tokenIdentifier, createdAt tras el login.
  users: defineTable({
    // Campos base de @convex-dev/auth (opcionales — gestionados por el auth)
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Campos de negocio (opcionales — completados por upsertCurrentUser)
    tokenIdentifier: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("operator"))),
    organizationId: v.optional(v.id("organizations")),
    createdAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_organizationId", ["organizationId"]),

  organizations: defineTable({
    name: v.string(),
    adminUserId: v.id("users"),
    maxOperators: v.number(), // default 5
    createdAt: v.number(),
  }),

  subscriptions: defineTable({
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled")
    ),
    plan: v.union(v.literal("starter"), v.literal("pro")),
    trialEndsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  operatorPermissions: defineTable({
    operatorId: v.id("users"),
    organizationId: v.id("organizations"),
    canAccessOperaciones: v.boolean(),
    canAccessAsistencia: v.boolean(),
    canAccessAcademia: v.boolean(),
    canAccessBitacora: v.boolean(),
  })
    .index("by_operatorId", ["operatorId"])
    .index("by_organizationId", ["organizationId"]),
});
