// convex/migrations.ts
// Migraciones de un solo uso, corridas manualmente por el desarrollador vía
// `npx convex run migrations:<nombre>`. No se exponen como mutation pública:
// internalMutation evita que el cliente las dispare por accidente.

import { internalMutation } from "./_generated/server";

const PLAN_SEED = [
  {
    key: "esencial",
    type: "operaciones" as const,
    name: "Esencial",
    price: 49,
    caudalMin: 0,
    caudalMax: 20,
    blurb: "Plantas pequeñas — operación básica.",
    order: 1,
    unlocks: {
      canAccessOperaciones: true,
      canAccessAsistencia: false,
      canAccessAcademia: false,
      canAccessBitacora: false,
      canAccessConsolaTecnica: true,
      canAccessHojaOperativa: true,
      canAccessStock: true,
      canAccessFinanzas: false,
    },
  },
  {
    key: "operativo",
    type: "operaciones" as const,
    name: "Operativo",
    price: 99,
    caudalMin: 20,
    caudalMax: 60,
    blurb: "Plantas medianas — suma finanzas completo.",
    order: 2,
    unlocks: {
      canAccessOperaciones: true,
      canAccessAsistencia: false,
      canAccessAcademia: false,
      canAccessBitacora: false,
      canAccessConsolaTecnica: true,
      canAccessHojaOperativa: true,
      canAccessStock: true,
      canAccessFinanzas: true,
    },
  },
  {
    key: "avanzado",
    type: "operaciones" as const,
    name: "Avanzado",
    price: 199,
    caudalMin: 60,
    caudalMax: 150,
    blurb: "Suma asistencia técnica y bitácora maestra.",
    order: 3,
    unlocks: {
      canAccessOperaciones: true,
      canAccessAsistencia: true,
      canAccessAcademia: false,
      canAccessBitacora: true,
      canAccessConsolaTecnica: true,
      canAccessHojaOperativa: true,
      canAccessStock: true,
      canAccessFinanzas: true,
    },
  },
  {
    key: "industrial",
    type: "operaciones" as const,
    name: "Industrial",
    price: 349,
    caudalMin: 150,
    caudalMax: 99999,
    blurb: "Plantas grandes — todos los módulos, incluida Academia.",
    order: 4,
    unlocks: {
      canAccessOperaciones: true,
      canAccessAsistencia: true,
      canAccessAcademia: true,
      canAccessBitacora: true,
      canAccessConsolaTecnica: true,
      canAccessHojaOperativa: true,
      canAccessStock: true,
      canAccessFinanzas: true,
    },
  },
  {
    key: "academia",
    type: "academia" as const,
    name: "Academia",
    price: 276,
    blurb: "Add-on de formación, independiente del caudal.",
    order: 5,
    unlocks: {
      canAccessOperaciones: false,
      canAccessAsistencia: false,
      canAccessAcademia: true,
      canAccessBitacora: false,
      canAccessConsolaTecnica: false,
      canAccessHojaOperativa: false,
      canAccessStock: false,
      canAccessFinanzas: false,
    },
  },
];

// Mapeo del enum viejo -> plan nuevo más cercano (por precio).
const LEGACY_PLAN_KEY: Record<"starter" | "pro", string> = {
  starter: "esencial",
  pro: "operativo",
};

/**
 * Paso 1: crea las 5 filas de `plans` y la fila única de `pricingConfig` si
 * no existen todavía. Idempotente — seguro correr más de una vez.
 */
export const seedPlans = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    for (const plan of PLAN_SEED) {
      const existing = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", plan.key))
        .unique();
      if (existing) continue;
      await ctx.db.insert("plans", plan);
      created++;
    }

    const pricing = await ctx.db.query("pricingConfig").first();
    if (!pricing) {
      await ctx.db.insert("pricingConfig", {
        sixMonthDiscountPct: 5,
        annualDiscountPct: 15,
      });
    }

    return { plansCreated: created, pricingConfigExisted: !!pricing };
  },
});

/**
 * Paso 2 (correr después de `seedPlans`): para cada suscripción sin
 * `planId`, lo fija según su `plan` legado (starter→esencial, pro→operativo).
 * Idempotente — filas que ya tienen `planId` se ignoran.
 */
export const backfillSubscriptionPlanIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const subs = await ctx.db.query("subscriptions").collect();
    let updated = 0;
    let skipped = 0;

    for (const sub of subs) {
      if (sub.planId) {
        skipped++;
        continue;
      }
      const targetKey = LEGACY_PLAN_KEY[sub.plan];
      const plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", targetKey))
        .unique();
      if (!plan) {
        throw new Error(
          `No se encontró el plan "${targetKey}" — corre seedPlans primero`
        );
      }
      await ctx.db.patch(sub._id, { planId: plan._id });
      updated++;
    }

    return { updated, skipped, total: subs.length };
  },
});
