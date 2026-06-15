// convex/superAdmin.ts
// Panel Owner (super-admin global). Gate por SUPER_ADMIN_EMAIL (un solo correo).
// Alcance GLOBAL: ve y administra cuentas de TODAS las organizaciones.
// El gate vive 100% en el backend: nunca confiar en el cliente.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthenticatedUser } from "./lib/auth";

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
] as const;

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
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
 */
async function requireSuperAdmin(ctx: AnyCtx): Promise<void> {
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

    const permsData = {
      operatorId: args.operatorId,
      organizationId: operator.organizationId,
      canAccessOperaciones: args.canAccessOperaciones,
      canAccessAsistencia: args.canAccessAsistencia,
      canAccessAcademia: args.canAccessAcademia,
      canAccessBitacora: args.canAccessBitacora,
      canAccessConsolaTecnica: args.canAccessConsolaTecnica ?? false,
      canAccessHojaOperativa: args.canAccessHojaOperativa ?? false,
      canAccessStock: args.canAccessStock ?? false,
      canAccessFinanzas: args.canAccessFinanzas ?? false,
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
    const orgById = new Map(orgs.map((o) => [o._id, o]));

    for (const s of currentSubs) {
      subsByStatus[s.status]++;
      subsByPlan[s.plan]++;
      if (s.status === "active") mrr += PLAN_PRICES[s.plan];
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

    return {
      totalOrgs: orgs.length,
      totalAccounts: users.length,
      totalAdmins,
      totalOperators,
      subsByStatus,
      subsByPlan,
      mrr,
      trialsExpiring,
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
          adminUserId: o.adminUserId,
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          adminCount: adminCount.get(o._id) ?? 0,
          operatorCount: operatorCount.get(o._id) ?? 0,
          subscription: sub
            ? {
                status: sub.status,
                plan: sub.plan,
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

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("subscriptions", {
      organizationId: args.organizationId,
      createdAt: Date.now(),
      ...patch,
    });
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
    });

    await ctx.db.patch(adminId, { organizationId: orgId });

    await ctx.db.insert("subscriptions", {
      organizationId: orgId,
      status: "trialing",
      plan: "starter",
      trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    return { adminId, orgId, email, orgName };
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
