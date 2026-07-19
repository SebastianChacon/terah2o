// convex/superAdmin.ts
// Panel Owner (super-admin global). Gate por SUPER_ADMIN_EMAIL (un solo correo).
// Alcance GLOBAL: ve y administra cuentas de TODAS las organizaciones.
// El gate vive 100% en el backend: nunca confiar en el cliente.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthenticatedUser } from "./lib/auth";
import {
  clampPerms,
  normalizePerms,
  readPerms,
  MODULE_PERMISSION_KEYS,
} from "./lib/permissions";

type AnyCtx = QueryCtx | MutationCtx;

// Precios de plan (USD/mes) — fuente para el MRR estimado del dashboard.
// No hay pasarela de pago real todavía: el MRR es una estimación.
const PLAN_PRICES = { starter: 49, pro: 89 } as const;

// Tablas de negocio con índice by_organizationId (para borrado en cascada).
const ORG_DATA_TABLES = [
  "visitas",
  "plantSettings",
  "inventoryItems",
  "shiftRecords",
  "financialProjections",
  "jarTestSessions",
  "bitacoraEntries",
  "ownerAuditLog",
] as const;

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// Mapeo del plan nuevo (tabla `plans`) al enum legado `starter`|`pro` que
// `subscriptions.plan` todavía exige (campo deprecated, ver schema.ts).
// Un plan de tier bajo se guarda como "starter", cualquier tier superior u
// "academia" como "pro" — solo importa para no romper el campo legado hasta
// que se elimine en la siguiente fase.
function legacyPlanFor(planKey: string): "starter" | "pro" {
  return planKey === "esencial" ? "starter" : "pro";
}

// Punto único de auditoría: cada mutation que cambia algo de un cliente lo
// llama. Append-only — nunca editar/borrar filas de ownerAuditLog salvo el
// borrado en cascada de la organización completa.
async function logOwnerAction(
  ctx: MutationCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  text: string
): Promise<void> {
  const me = await getAuthenticatedUser(ctx);
  await ctx.db.insert("ownerAuditLog", {
    organizationId,
    text,
    actorEmail: normalizeEmail(me?.email) || superAdminEmail(),
    createdAt: Date.now(),
  });
}

/**
 * Devuelve el correo del super-admin configurado, o "" si no hay env var.
 * Lee process.env en el backend de Convex (configurar en Convex Dashboard).
 */
function superAdminEmail(): string {
  return normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
}

/**
 * true si el usuario autenticado es el super-admin. No lanza.
 */
async function isSuperAdmin(ctx: AnyCtx): Promise<boolean> {
  const allowed = superAdminEmail();
  if (!allowed) return false; // sin env var configurada → nadie es owner

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const user = await getAuthenticatedUser(ctx);
  const callerEmail = normalizeEmail(user?.email ?? identity.email);
  return callerEmail !== "" && callerEmail === allowed;
}

/**
 * Lanza si el usuario autenticado no es el super-admin.
 * Exportado para que otros módulos del backend (p.ej. paymentSettings.ts)
 * puedan gatear sus propias mutations/queries sin duplicar esta lógica.
 */
export async function requireSuperAdmin(ctx: AnyCtx): Promise<void> {
  if (!(await isSuperAdmin(ctx))) throw new Error("No autorizado");
}

// ── ¿Soy el super-admin? (gate de UI, no lanza) ───────────────────────────
export const amISuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    return await isSuperAdmin(ctx);
  },
});

// ── Listar TODAS las cuentas del sistema (global) ─────────────────────────
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const subs = await ctx.db.query("subscriptions").collect();
    const perms = await ctx.db.query("operatorPermissions").collect();

    const orgById = new Map(orgs.map((o) => [o._id, o]));
    const subByOrg = new Map(subs.map((s) => [s.organizationId, s]));
    const permByOperator = new Map(perms.map((p) => [p.operatorId, p]));

    return users.map((u) => {
      const org = u.organizationId ? orgById.get(u.organizationId) : undefined;
      const sub = u.organizationId ? subByOrg.get(u.organizationId) : undefined;
      const perm = permByOperator.get(u._id);
      const role = u.role ?? "operator"; // sin rol → tratado como operador

      return {
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        clerkId: u.clerkId ?? null,
        role,
        organizationId: u.organizationId ?? null,
        orgName: org?.name ?? null,
        isOrgOwner: org ? org.adminUserId === u._id : false,
        subStatus: sub?.status ?? null,
        subPlan: sub?.plan ?? null,
        permissions:
          role === "operator"
            ? {
                canAccessOperaciones: perm?.canAccessOperaciones ?? false,
                canAccessAsistencia: perm?.canAccessAsistencia ?? false,
                canAccessAcademia: perm?.canAccessAcademia ?? false,
                canAccessBitacora: perm?.canAccessBitacora ?? false,
                canAccessConsolaTecnica: perm?.canAccessConsolaTecnica ?? false,
                canAccessHojaOperativa: perm?.canAccessHojaOperativa ?? false,
                canAccessStock: perm?.canAccessStock ?? false,
                canAccessFinanzas: perm?.canAccessFinanzas ?? false,
              }
            : null, // admins tienen acceso total por diseño (AuthGuard)
      };
    });
  },
});

// ── Fijar permisos de cualquier operador (sin filtro de org) ──────────────
export const setPermissionsGlobal = mutation({
  args: {
    operatorId: v.id("users"),
    canAccessOperaciones: v.boolean(),
    canAccessAsistencia: v.boolean(),
    canAccessAcademia: v.boolean(),
    canAccessBitacora: v.boolean(),
    canAccessConsolaTecnica: v.optional(v.boolean()),
    canAccessHojaOperativa: v.optional(v.boolean()),
    canAccessStock: v.optional(v.boolean()),
    canAccessFinanzas: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const operator = await ctx.db.get(args.operatorId);
    if (!operator) throw new Error("Usuario no encontrado");
    if (!operator.organizationId)
      throw new Error("El usuario no tiene organización asignada");

    const existing = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .unique();

    // Topar contra los entitlements de la org del operador (regla de subconjunto).
    const org = await ctx.db.get(operator.organizationId);
    const orgEnt = normalizePerms(readPerms(org));
    const clamped = clampPerms(readPerms(args), orgEnt);

    const permsData = {
      operatorId: args.operatorId,
      organizationId: operator.organizationId,
      ...clamped,
    };

    if (existing) {
      await ctx.db.patch(existing._id, permsData);
      return existing._id;
    }
    return await ctx.db.insert("operatorPermissions", permsData);
  },
});

// ── Eliminar cualquier cuenta (global) ────────────────────────────────────
// Reglas de seguridad: no borrar al propio super-admin ni al dueño de una org.
// Devuelve { clerkId, email } para que la API route borre la cuenta Clerk.
export const deleteUserGlobal = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Usuario no encontrado");

    // No permitir que el owner se elimine a sí mismo
    const me = await getAuthenticatedUser(ctx);
    if (me && me._id === target._id)
      throw new Error("No puedes eliminar tu propia cuenta de super-admin");

    // No permitir orfanar una organización (su admin dueño)
    if (target.organizationId) {
      const org = await ctx.db.get(target.organizationId);
      if (org && org.adminUserId === target._id)
        throw new Error(
          "No puedes eliminar al administrador dueño de una organización"
        );
    }

    // Borrar permisos asociados (si existen)
    const perm = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", target._id))
      .unique();
    if (perm) await ctx.db.delete(perm._id);

    const result = { clerkId: target.clerkId ?? null, email: target.email ?? null };
    await ctx.db.delete(target._id);
    return result;
  },
});

// ── Dashboard global: métricas del negocio ────────────────────────────────
export const getOwnerDashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const subs = await ctx.db.query("subscriptions").collect();
    const plans = await ctx.db.query("plans").collect();
    const planById = new Map(plans.map((p) => [p._id, p]));

    let totalAdmins = 0;
    let totalOperators = 0;
    for (const u of users) {
      if ((u.role ?? "operator") === "admin") totalAdmins++;
      else totalOperators++;
    }

    // Última suscripción por org (puede haber más de una histórica).
    const subByOrg = new Map<string, (typeof subs)[number]>();
    for (const s of subs) {
      const prev = subByOrg.get(s.organizationId);
      if (!prev || s.createdAt > prev.createdAt) subByOrg.set(s.organizationId, s);
    }
    const currentSubs = Array.from(subByOrg.values());

    const subsByStatus = { trialing: 0, active: 0, past_due: 0, canceled: 0 };
    const subsByPlan = { starter: 0, pro: 0 };
    let mrr = 0;
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const trialsExpiring: {
      organizationId: string;
      orgName: string | null;
      trialEndsAt: number;
    }[] = [];
    const activeExpiring: {
      organizationId: string;
      orgName: string | null;
      expiresAt: number;
    }[] = [];
    const orgById = new Map(orgs.map((o) => [o._id, o]));

    for (const s of currentSubs) {
      subsByStatus[s.status]++;
      subsByPlan[s.plan]++;
      if (s.status === "active") {
        const plan = s.planId ? planById.get(s.planId) : undefined;
        mrr += plan ? plan.price : PLAN_PRICES[s.plan];
        if (s.expiresAt && s.expiresAt - now <= WEEK) {
          activeExpiring.push({
            organizationId: s.organizationId,
            orgName: orgById.get(s.organizationId)?.name ?? null,
            expiresAt: s.expiresAt,
          });
        }
      }
      if (
        s.status === "trialing" &&
        s.trialEndsAt &&
        s.trialEndsAt - now <= WEEK
      ) {
        trialsExpiring.push({
          organizationId: s.organizationId,
          orgName: orgById.get(s.organizationId)?.name ?? null,
          trialEndsAt: s.trialEndsAt,
        });
      }
    }
    trialsExpiring.sort((a, b) => a.trialEndsAt - b.trialEndsAt);
    activeExpiring.sort((a, b) => a.expiresAt - b.expiresAt);

    return {
      totalOrgs: orgs.length,
      totalAccounts: users.length,
      totalAdmins,
      totalOperators,
      subsByStatus,
      subsByPlan,
      mrr,
      trialsExpiring,
      activeExpiring,
    };
  },
});

// ── Listar TODAS las organizaciones (enriquecidas) ────────────────────────
export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const orgs = await ctx.db.query("organizations").collect();
    const users = await ctx.db.query("users").collect();
    const subs = await ctx.db.query("subscriptions").collect();

    const userById = new Map(users.map((u) => [u._id, u]));

    const adminCount = new Map<string, number>();
    const operatorCount = new Map<string, number>();
    for (const u of users) {
      if (!u.organizationId) continue;
      const role = u.role ?? "operator";
      const target = role === "admin" ? adminCount : operatorCount;
      target.set(u.organizationId, (target.get(u.organizationId) ?? 0) + 1);
    }

    const subByOrg = new Map<string, (typeof subs)[number]>();
    for (const s of subs) {
      const prev = subByOrg.get(s.organizationId);
      if (!prev || s.createdAt > prev.createdAt) subByOrg.set(s.organizationId, s);
    }

    return orgs
      .map((o) => {
        const owner = userById.get(o.adminUserId);
        const sub = subByOrg.get(o._id);
        return {
          _id: o._id,
          name: o.name,
          createdAt: o.createdAt,
          maxOperators: o.maxOperators,
          maxAdmins: o.maxAdmins ?? 2,
          entitlements: normalizePerms(readPerms(o)),
          adminUserId: o.adminUserId,
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          adminCount: adminCount.get(o._id) ?? 0,
          operatorCount: operatorCount.get(o._id) ?? 0,
          contractType: o.contractType ?? null,
          contractNumber: o.contractNumber ?? null,
          contractMonths: o.contractMonths ?? null,
          plantProfile: o.plantProfile ?? null,
          contactCargo: o.contactCargo ?? null,
          contactPhone: o.contactPhone ?? null,
          region: o.region ?? null,
          address: o.address ?? null,
          subscription: sub
            ? {
                status: sub.status,
                plan: sub.plan,
                planId: sub.planId ?? null,
                trialEndsAt: sub.trialEndsAt ?? null,
                expiresAt: sub.expiresAt ?? null,
              }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ── Fijar suscripción de cualquier org (palanca comercial) ────────────────
export const setSubscriptionGlobal = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .order("desc")
      .first();

    const patch = {
      status: args.status,
      plan: args.plan,
      trialEndsAt: args.trialEndsAt,
      expiresAt: args.expiresAt,
    };

    let result;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      result = existing._id;
    } else {
      result = await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        createdAt: Date.now(),
        ...patch,
      });
    }

    await logOwnerAction(
      ctx,
      args.organizationId,
      `Suscripción fijada: ${args.status} · ${args.plan}`
    );
    return result;
  },
});

// ── Fijar el plan (tabla `plans`, por caudal) de la suscripción de una org ─
export const setOrgPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan no encontrado");

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .order("desc")
      .first();

    const legacyPlan = legacyPlanFor(plan.key);

    let result;
    if (existing) {
      await ctx.db.patch(existing._id, { planId: args.planId, plan: legacyPlan });
      result = existing._id;
    } else {
      result = await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        status: "trialing",
        plan: legacyPlan,
        planId: args.planId,
        createdAt: Date.now(),
      });
    }

    await logOwnerAction(ctx, args.organizationId, `Plan cambiado a "${plan.name}"`);
    return result;
  },
});

// ── Datos de contrato (metadata comercial, sin efecto operativo) ──────────
export const setOrgContract = mutation({
  args: {
    organizationId: v.id("organizations"),
    contractType: v.optional(v.union(v.literal("directa"), v.literal("sercop"))),
    contractNumber: v.optional(v.string()),
    contractMonths: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    await ctx.db.patch(args.organizationId, {
      contractType: args.contractType,
      contractNumber: args.contractNumber?.trim() || undefined,
      contractMonths: args.contractMonths,
    });

    await logOwnerAction(ctx, args.organizationId, "Datos de contrato actualizados");
    return args.organizationId;
  },
});

// ── Perfil de planta (metadata comercial — NO usar para cálculos operativos,
// esos viven en `plantSettings`) ──────────────────────────────────────────
export const setOrgPlantProfile = mutation({
  args: {
    organizationId: v.id("organizations"),
    caudalLs: v.number(),
    coagType: v.string(),
    kgMonth: v.number(),
    habitantes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    if (args.caudalLs < 0 || args.kgMonth < 0 || args.habitantes < 0)
      throw new Error("Los valores del perfil de planta no pueden ser negativos");

    await ctx.db.patch(args.organizationId, {
      plantProfile: {
        caudalLs: args.caudalLs,
        coagType: args.coagType.trim(),
        kgMonth: args.kgMonth,
        habitantes: args.habitantes,
      },
    });

    await logOwnerAction(ctx, args.organizationId, "Perfil de planta actualizado");
    return args.organizationId;
  },
});

// ── Bitácora de auditoría del Owner, por organización ─────────────────────
export const listOwnerAuditLog = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const rows = await ctx.db
      .query("ownerAuditLog")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ── Editar un plan comercial (precio, rango de caudal, entitlements) ──────
export const updatePlan = mutation({
  args: {
    planId: v.id("plans"),
    name: v.optional(v.string()),
    price: v.optional(v.number()),
    caudalMin: v.optional(v.number()),
    caudalMax: v.optional(v.number()),
    blurb: v.optional(v.string()),
    unlocks: v.optional(
      v.object({
        canAccessOperaciones: v.boolean(),
        canAccessAsistencia: v.boolean(),
        canAccessAcademia: v.boolean(),
        canAccessBitacora: v.boolean(),
        canAccessConsolaTecnica: v.boolean(),
        canAccessHojaOperativa: v.boolean(),
        canAccessStock: v.boolean(),
        canAccessFinanzas: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan no encontrado");

    if (args.price !== undefined && args.price < 0)
      throw new Error("El precio no puede ser negativo");

    const nextMin = args.caudalMin ?? plan.caudalMin;
    const nextMax = args.caudalMax ?? plan.caudalMax;
    if (nextMin !== undefined && nextMax !== undefined && nextMin >= nextMax)
      throw new Error("El caudal mínimo debe ser menor al máximo");

    if (plan.type === "operaciones" && nextMin !== undefined && nextMax !== undefined) {
      const others = await ctx.db
        .query("plans")
        .filter((q) => q.eq(q.field("type"), "operaciones"))
        .collect();
      const overlap = others.some(
        (o) =>
          o._id !== args.planId &&
          o.caudalMin !== undefined &&
          o.caudalMax !== undefined &&
          nextMin < o.caudalMax &&
          nextMax > o.caudalMin
      );
      if (overlap)
        throw new Error("El rango de caudal se traslapa con otro plan existente");
    }

    await ctx.db.patch(args.planId, {
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
      ...(args.price !== undefined ? { price: args.price } : {}),
      ...(args.caudalMin !== undefined ? { caudalMin: args.caudalMin } : {}),
      ...(args.caudalMax !== undefined ? { caudalMax: args.caudalMax } : {}),
      ...(args.blurb !== undefined ? { blurb: args.blurb } : {}),
      ...(args.unlocks !== undefined ? { unlocks: args.unlocks } : {}),
    });

    return args.planId;
  },
});

// ── Editar descuentos de término (6 meses / anual) ────────────────────────
export const updatePricingConfig = mutation({
  args: {
    sixMonthDiscountPct: v.number(),
    annualDiscountPct: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    if (
      args.sixMonthDiscountPct < 0 ||
      args.sixMonthDiscountPct > 100 ||
      args.annualDiscountPct < 0 ||
      args.annualDiscountPct > 100
    )
      throw new Error("El descuento debe estar entre 0 y 100%");

    const existing = await ctx.db.query("pricingConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("pricingConfig", args);
  },
});

// ── Analítica de uso real (usageEvents) ───────────────────────────────────
export const getUsageAnalytics = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const events = args.organizationId
      ? await ctx.db
          .query("usageEvents")
          .withIndex("by_org_day", (q) =>
            q.eq("organizationId", args.organizationId!)
          )
          .collect()
      : await ctx.db.query("usageEvents").collect();

    const orgs = await ctx.db.query("organizations").collect();
    const orgById = new Map(orgs.map((o) => [o._id, o]));

    const dailyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();
    const byOrg = new Map<
      string,
      { orgName: string; daily: Map<string, number>; monthly: Map<string, number> }
    >();

    for (const e of events) {
      dailyMap.set(e.day, (dailyMap.get(e.day) ?? 0) + 1);
      const ym = e.day.slice(0, 7);
      monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + 1);

      const key = e.organizationId as unknown as string;
      if (!byOrg.has(key)) {
        byOrg.set(key, {
          orgName: orgById.get(e.organizationId)?.name ?? "—",
          daily: new Map(),
          monthly: new Map(),
        });
      }
      const bucket = byOrg.get(key)!;
      bucket.daily.set(e.day, (bucket.daily.get(e.day) ?? 0) + 1);
      bucket.monthly.set(ym, (bucket.monthly.get(ym) ?? 0) + 1);
    }

    const toSortedArray = <K extends string>(m: Map<K, number>, keyName: string) =>
      Array.from(m.entries())
        .map(([k, count]) => ({ [keyName]: k, count }))
        .sort((a, b) => String(a[keyName]).localeCompare(String(b[keyName])));

    return {
      totalEvents: events.length,
      daily: toSortedArray(dailyMap, "date"),
      monthly: toSortedArray(monthlyMap, "ym"),
      byOrg: Array.from(byOrg.entries()).map(([organizationId, v]) => ({
        organizationId,
        orgName: v.orgName,
        daily: toSortedArray(v.daily, "date"),
        monthly: toSortedArray(v.monthly, "ym"),
      })),
    };
  },
});

// ── Promover / degradar rol de cualquier usuario ──────────────────────────
export const setUserRoleGlobal = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("operator")),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Usuario no encontrado");
    if (!user.organizationId)
      throw new Error("El usuario no tiene organización asignada");

    // No cambiar el rol del dueño de la organización (rompería AuthGuard/ownership).
    const org = await ctx.db.get(user.organizationId);
    if (org && org.adminUserId === user._id)
      throw new Error(
        "No puedes cambiar el rol del dueño de la organización. Transfiere la propiedad primero."
      );

    if ((user.role ?? "operator") === args.role) return user._id;

    await ctx.db.patch(user._id, { role: args.role });

    const existingPerm = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .unique();

    if (args.role === "admin") {
      // Admin = acceso total por diseño → no necesita fila de permisos.
      if (existingPerm) await ctx.db.delete(existingPerm._id);
    } else if (!existingPerm) {
      // Degradado a operador → crear permisos default (todo bloqueado).
      await ctx.db.insert("operatorPermissions", {
        operatorId: user._id,
        organizationId: user.organizationId,
        canAccessOperaciones: false,
        canAccessAsistencia: false,
        canAccessAcademia: false,
        canAccessBitacora: false,
      });
    }

    return user._id;
  },
});

// ── Transferir propiedad de una organización a otro admin ─────────────────
export const transferOrgOwnership = mutation({
  args: {
    organizationId: v.id("organizations"),
    newAdminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    const newOwner = await ctx.db.get(args.newAdminUserId);
    if (!newOwner) throw new Error("Usuario destino no encontrado");
    if (newOwner.organizationId !== args.organizationId)
      throw new Error("El nuevo dueño no pertenece a esta organización");
    if ((newOwner.role ?? "operator") !== "admin")
      throw new Error("El nuevo dueño debe ser administrador");

    await ctx.db.patch(args.organizationId, { adminUserId: args.newAdminUserId });
    await logOwnerAction(
      ctx,
      args.organizationId,
      `Propiedad transferida a ${newOwner.name ?? newOwner.email ?? newOwner._id}`
    );
    return args.organizationId;
  },
});

// ── Cambiar cupo de operadores (seats) de una org ─────────────────────────
export const setMaxOperators = mutation({
  args: {
    organizationId: v.id("organizations"),
    maxOperators: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    if (!Number.isInteger(args.maxOperators) || args.maxOperators < 1)
      throw new Error("El cupo debe ser un entero ≥ 1");

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    const operators = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "operator"))
      .collect();

    if (args.maxOperators < operators.length)
      throw new Error(
        `La org ya tiene ${operators.length} operadores; el cupo no puede ser menor`
      );

    await ctx.db.patch(args.organizationId, { maxOperators: args.maxOperators });
    await logOwnerAction(
      ctx,
      args.organizationId,
      `Cupo de operadores actualizado a ${args.maxOperators}`
    );
    return args.organizationId;
  },
});

// ── Cambiar cupo de administradores de una org ────────────────────────────
export const setMaxAdmins = mutation({
  args: {
    organizationId: v.id("organizations"),
    maxAdmins: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    if (!Number.isInteger(args.maxAdmins) || args.maxAdmins < 1)
      throw new Error("El cupo debe ser un entero ≥ 1");

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    const admins = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    if (args.maxAdmins < admins.length)
      throw new Error(
        `La org ya tiene ${admins.length} administradores; el cupo no puede ser menor`
      );

    await ctx.db.patch(args.organizationId, { maxAdmins: args.maxAdmins });
    await logOwnerAction(
      ctx,
      args.organizationId,
      `Cupo de administradores actualizado a ${args.maxAdmins}`
    );
    return args.organizationId;
  },
});

// ── Fijar entitlements (páginas habilitadas) de una org ───────────────────
// Define QUÉ páginas tiene la org. Topa al admin y a sus operadores.
export const setOrgEntitlements = mutation({
  args: {
    organizationId: v.id("organizations"),
    canAccessOperaciones: v.boolean(),
    canAccessAsistencia: v.boolean(),
    canAccessAcademia: v.boolean(),
    canAccessBitacora: v.boolean(),
    canAccessConsolaTecnica: v.boolean(),
    canAccessHojaOperativa: v.boolean(),
    canAccessStock: v.boolean(),
    canAccessFinanzas: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    // Normalizar: si Operaciones está off, los sub-módulos también.
    const ent = normalizePerms(readPerms(args));

    await ctx.db.patch(args.organizationId, ent);

    // Si la org pierde una página, ningún operador debe conservarla: topamos
    // las filas de permisos de sus operadores contra los nuevos entitlements.
    const perms = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
    for (const p of perms) {
      const clamped = clampPerms(readPerms(p), ent);
      const changed = MODULE_PERMISSION_KEYS.some((k) => clamped[k] !== readPerms(p)[k]);
      if (changed) await ctx.db.patch(p._id, clamped);
    }

    await logOwnerAction(ctx, args.organizationId, "Páginas habilitadas actualizadas");
    return args.organizationId;
  },
});

// ── Renombrar cualquier organización ──────────────────────────────────────
export const renameOrganizationGlobal = mutation({
  args: { organizationId: v.id("organizations"), name: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const name = args.name.trim();
    if (!name) throw new Error("El nombre no puede estar vacío");

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    await ctx.db.patch(args.organizationId, { name });
    await logOwnerAction(ctx, args.organizationId, `Renombrada de "${org.name}" a "${name}"`);
    return args.organizationId;
  },
});

// ── Onboarding: crear org + admin dueño + trial ───────────────────────────
// El admin se pre-registra; su clerkId se vincula en el primer login (igual
// que inviteAdmin). Devuelve datos para enviar el correo de invitación.
export const createClientOrg = mutation({
  args: {
    orgName: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    cargo: v.optional(v.string()),
    phone: v.optional(v.string()),
    region: v.optional(v.string()),
    address: v.optional(v.string()),
    planId: v.optional(v.id("plans")),
    trial: v.optional(v.boolean()), // default true (comportamiento histórico)
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const orgName = args.orgName.trim();
    const adminName = args.adminName.trim();
    const email = args.adminEmail.trim().toLowerCase();
    if (!orgName || !adminName || !email)
      throw new Error("Se requieren nombre de org, nombre y correo del admin");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing)
      throw new Error("Ya existe un usuario con ese correo electrónico");

    const plan = args.planId ? await ctx.db.get(args.planId) : null;
    if (args.planId && !plan) throw new Error("Plan no encontrado");

    const adminId = await ctx.db.insert("users", {
      email,
      name: adminName,
      role: "admin",
      createdAt: Date.now(),
    });

    const orgId = await ctx.db.insert("organizations", {
      name: orgName,
      adminUserId: adminId,
      maxOperators: 3,
      createdAt: Date.now(),
      contactCargo: args.cargo?.trim() || undefined,
      contactPhone: args.phone?.trim() || undefined,
      region: args.region?.trim() || undefined,
      address: args.address?.trim() || undefined,
      // El plan elegido desbloquea sus páginas de inmediato — de lo contrario
      // el admin quedaría sin acceso a nada (entitlements default-OFF).
      ...(plan ? normalizePerms(plan.unlocks) : {}),
    });

    await ctx.db.patch(adminId, { organizationId: orgId });

    const trial = args.trial ?? true;
    await ctx.db.insert("subscriptions", {
      organizationId: orgId,
      status: trial ? "trialing" : "active",
      plan: plan ? legacyPlanFor(plan.key) : "starter",
      planId: args.planId,
      trialEndsAt: trial ? Date.now() + 14 * 24 * 60 * 60 * 1000 : undefined,
      createdAt: Date.now(),
    });

    await logOwnerAction(
      ctx,
      orgId,
      `Cliente creado: ${orgName} (admin ${email})${plan ? ` · plan ${plan.name}` : ""}${trial ? " · trial 14d" : " · activa sin prueba"}`
    );

    return { adminId, orgId, email, orgName };
  },
});

// ── Editar datos de contacto comercial de una org ──────────────────────────
export const setOrgContactInfo = mutation({
  args: {
    organizationId: v.id("organizations"),
    contactCargo: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    region: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    await ctx.db.patch(args.organizationId, {
      contactCargo: args.contactCargo?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      region: args.region?.trim() || undefined,
      address: args.address?.trim() || undefined,
    });

    await logOwnerAction(ctx, args.organizationId, "Datos de contacto actualizados");
    return args.organizationId;
  },
});

// ── Eliminar una organización completa (cascada) ──────────────────────────
// Borra: datos de negocio, permisos, suscripciones, usuarios y el doc org.
// Devuelve los {clerkId,email} de los usuarios para que la API borre Clerk.
export const deleteOrganizationGlobal = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    const members = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    // Guard: no borrar la org que contiene al propio owner (autodestrucción).
    const me = await getAuthenticatedUser(ctx);
    if (me && members.some((m) => m._id === me._id))
      throw new Error("No puedes eliminar la organización a la que perteneces");

    const clerkIds = members.map((m) => ({
      clerkId: m.clerkId ?? null,
      email: m.email ?? null,
    }));

    // 1. Datos de negocio por tabla
    for (const table of ORG_DATA_TABLES) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

    // 1b. usageEvents (índice compuesto by_org_day, no by_organizationId)
    const usageRows = await ctx.db
      .query("usageEvents")
      .withIndex("by_org_day", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const row of usageRows) await ctx.db.delete(row._id);

    // 2. Permisos de operadores de la org
    const perms = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
    for (const p of perms) await ctx.db.delete(p._id);

    // 3. Suscripciones
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
    for (const s of subs) await ctx.db.delete(s._id);

    // 4. Usuarios
    for (const m of members) await ctx.db.delete(m._id);

    // 5. La organización
    await ctx.db.delete(args.organizationId);

    return { clerkIds };
  },
});
