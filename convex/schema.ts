import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
  }).index("by_tipo", ["tipoCliente"]),

  plantSettings: defineTable({
    location: v.string(),
    plantSize: v.string(),
    chemical: v.string(),
    avgDose: v.number(),
    avgConc: v.number(),
    lastFetch: v.optional(v.string()),
  }),

  inventoryItems: defineTable({
    itemId: v.string(),
    itemName: v.string(),
    amount: v.number(),
    unit: v.string(),
    minimumLevel: v.number(),
    dailyConsumption: v.number(),
    isCorrelated: v.boolean(),
    lastUpdated: v.optional(v.string()),
  }).index("by_itemId", ["itemId"]),

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
  }).index("by_date", ["date"]),

  financialProjections: defineTable({
    institutionName: v.string(),
    mode: v.union(v.literal("projection"), v.literal("analysis")),
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
  }),

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
  }),

  bitacoraEntries: defineTable({
    date: v.string(),
    source: v.string(),
    category: v.string(),
    summary: v.string(),
  })
    .index("by_date", ["date"])
    .index("by_category", ["category"]),
});
