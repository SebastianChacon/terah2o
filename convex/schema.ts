import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    operatorId: v.optional(v.id("users")),
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
    // Datos necesarios para reproducir la Memoria Técnica completa (paridad
    // con la Consola). Opcionales → compatibles con filas previas.
    targetDoses: v.optional(
      v.object({
        coag: v.number(),
        ph: v.number(),
        helper: v.number(),
        oxid: v.number(),
      })
    ),
    baselineAforos: v.optional(
      v.array(v.object({ name: v.string(), aforo: v.number() }))
    ),
    organizationId: v.optional(v.id("organizations")),
  }).index("by_organizationId", ["organizationId"]),

  bitacoraEntries: defineTable({
    date: v.string(),
    source: v.string(),
    category: v.string(),
    summary: v.string(),
    operatorId: v.optional(v.id("users")),
    operatorName: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_date", ["date"])
    .index("by_category", ["category"])
    .index("by_organizationId", ["organizationId"]),

  // ── Nuevas tablas de negocio ───────────────────────────────────────────────

  // users — tabla de negocio propia (Clerk maneja la identidad externamente).
  // clerkId = identity.subject del JWT emitido por Clerk.
  users: defineTable({
    clerkId: v.optional(v.string()),          // Clerk user ID ("user_2abc...")
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),  // mantenido para operadores pre-creados
    role: v.optional(v.union(v.literal("admin"), v.literal("operator"))),
    organizationId: v.optional(v.id("organizations")),
    createdAt: v.optional(v.number()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_organizationId", ["organizationId"]),

  organizations: defineTable({
    name: v.string(),
    adminUserId: v.id("users"),
    maxOperators: v.number(), // default 5
    maxAdmins: v.optional(v.number()), // default lógico 2
    // Entitlements de organización (qué páginas tiene la org). Controlados por
    // el Owner desde /owner. Ausente ⇒ false (default-OFF). Topan al admin y,
    // por transitividad, a sus operadores.
    canAccessOperaciones: v.optional(v.boolean()),
    canAccessAsistencia: v.optional(v.boolean()),
    canAccessAcademia: v.optional(v.boolean()),
    canAccessBitacora: v.optional(v.boolean()),
    canAccessConsolaTecnica: v.optional(v.boolean()),
    canAccessHojaOperativa: v.optional(v.boolean()),
    canAccessStock: v.optional(v.boolean()),
    canAccessFinanzas: v.optional(v.boolean()),
    // Metadata comercial/contractual (rellenada por el Owner). Deliberadamente
    // separada de `plantSettings` (config operativa usada por los cálculos):
    // editar un dato de venta aquí nunca debe alterar un cálculo en producción.
    contractType: v.optional(v.union(v.literal("directa"), v.literal("sercop"))),
    contractNumber: v.optional(v.string()),
    contractMonths: v.optional(v.number()),
    plantProfile: v.optional(
      v.object({
        caudalLs: v.number(),
        coagType: v.string(),
        kgMonth: v.number(),
        habitantes: v.number(),
      })
    ),
    createdAt: v.number(),
  }),

  // Planes comerciales por caudal (reemplaza el enum fijo starter/pro).
  // Editable desde /owner sin deploy: precio, rango de caudal y qué
  // entitlements desbloquea cada plan.
  plans: defineTable({
    key: v.string(), // "esencial" | "operativo" | "avanzado" | "industrial" | "academia"
    type: v.union(v.literal("operaciones"), v.literal("academia")),
    name: v.string(),
    price: v.number(), // mensual (o único, para academia)
    caudalMin: v.optional(v.number()),
    caudalMax: v.optional(v.number()),
    blurb: v.optional(v.string()),
    unlocks: v.object({
      canAccessOperaciones: v.boolean(),
      canAccessAsistencia: v.boolean(),
      canAccessAcademia: v.boolean(),
      canAccessBitacora: v.boolean(),
      canAccessConsolaTecnica: v.boolean(),
      canAccessHojaOperativa: v.boolean(),
      canAccessStock: v.boolean(),
      canAccessFinanzas: v.boolean(),
    }),
    order: v.number(),
  }).index("by_key", ["key"]),

  // Fila única con los descuentos de término (%) usados para derivar los
  // precios de 6 meses / anual a partir del precio mensual de cada plan.
  pricingConfig: defineTable({
    sixMonthDiscountPct: v.number(),
    annualDiscountPct: v.number(),
  }),

  subscriptions: defineTable({
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled")
    ),
    // DEPRECATED: enum fijo, reemplazado por `planId`. Se conserva temporalmente
    // durante la migración a la tabla `plans`; no usar en código nuevo.
    plan: v.union(v.literal("starter"), v.literal("pro")),
    planId: v.optional(v.id("plans")),
    trialEndsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  // Bitácora de auditoría del Owner (acciones sobre cuentas/clientes). Distinta
  // de `bitacoraEntries` (que es operativa, de planta). Append-only: ninguna
  // mutation debe editar ni borrar filas de aquí, salvo el borrado en cascada
  // de la organización completa.
  ownerAuditLog: defineTable({
    organizationId: v.id("organizations"),
    text: v.string(),
    actorEmail: v.string(),
    createdAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  // Un evento por sesión iniciada (no por request) — instrumentado en
  // upsertCurrentUser. Agregado por getUsageAnalytics para la vista de uso.
  usageEvents: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    day: v.string(), // "YYYY-MM-DD"
    createdAt: v.number(),
  }).index("by_org_day", ["organizationId", "day"]),

  operatorPermissions: defineTable({
    operatorId: v.id("users"),
    organizationId: v.id("organizations"),
    // Top-level module permissions
    canAccessOperaciones: v.boolean(),
    canAccessAsistencia: v.boolean(),
    canAccessAcademia: v.boolean(),
    canAccessBitacora: v.boolean(),
    // Sub-module permissions (within /operaciones)
    canAccessConsolaTecnica: v.optional(v.boolean()),
    canAccessHojaOperativa: v.optional(v.boolean()),
    canAccessStock: v.optional(v.boolean()),
    canAccessFinanzas: v.optional(v.boolean()),
  })
    .index("by_operatorId", ["operatorId"])
    .index("by_organizationId", ["organizationId"]),
});
