import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUserId } from "./lib/auth";

export const create = mutation({
  args: {
    code: v.string(),
    point: v.union(v.literal("SALIDA"), v.literal("CRUDA"), v.literal("RED")),
    planta: v.optional(v.string()),
    operador: v.optional(v.string()),
    sector: v.optional(v.string()),
    provincia: v.optional(v.string()),
    canton: v.optional(v.string()),
    caudal: v.optional(v.number()),
    fecha: v.string(),
    hora: v.optional(v.string()),
    analista: v.optional(v.string()),
    responsable: v.optional(v.string()),
    metodo: v.optional(v.string()),
    calibracion: v.optional(v.string()),
    certificado: v.optional(v.string()),
    producto: v.optional(v.string()),
    diagnostico: v.optional(v.string()),
    results: v.record(v.string(), v.string()),
    pct: v.number(),
    fail: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    return await ctx.db.insert("waterQualityTests", {
      ...args,
      organizationId: user?.organizationId,
    });
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      // Compatibilidad: devolver sin filtro si no hay org (usuarios legacy)
      return await ctx.db.query("waterQualityTests").order("desc").collect();
    }
    return await ctx.db
      .query("waterQualityTests")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .order("desc")
      .collect();
  },
});

export const update = mutation({
  args: {
    id: v.id("waterQualityTests"),
    diagnostico: v.optional(v.string()),
    results: v.optional(v.record(v.string(), v.string())),
    pct: v.optional(v.number()),
    fail: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Ensayo no encontrado");
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("waterQualityTests") },
  handler: async (ctx, args) => {
    const capaRows = await ctx.db
      .query("waterQualityCapaActions")
      .withIndex("by_testId", (q) => q.eq("testId", args.id))
      .collect();
    for (const row of capaRows) await ctx.db.delete(row._id);
    await ctx.db.delete(args.id);
  },
});

// Verificación de certificado por código QR. Requiere sesión (Clerk) como el
// resto de la plataforma, pero deliberadamente NO filtra por organización:
// el propósito de esta query es confirmar la autenticidad de un certificado
// para cualquier usuario autenticado de TeraH2O, cruzando el límite de su
// propia organización. Por eso devuelve solo los campos que se muestran en
// la pantalla de verificación, nunca el registro completo ni datos internos.
export const getForVerify = query({
  args: { code: v.optional(v.string()), id: v.optional(v.id("waterQualityTests")) },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;

    let doc = null;
    if (args.id) doc = await ctx.db.get(args.id);
    if (!doc && args.code) {
      doc = await ctx.db
        .query("waterQualityTests")
        .filter((q) => q.eq(q.field("code"), args.code))
        .first();
    }
    if (!doc) return null;

    return {
      code: doc.code,
      point: doc.point,
      planta: doc.planta,
      provincia: doc.provincia,
      canton: doc.canton,
      fecha: doc.fecha,
      hora: doc.hora,
      analista: doc.analista,
      responsable: doc.responsable,
      results: doc.results,
      pct: doc.pct,
      fail: doc.fail,
    };
  },
});
