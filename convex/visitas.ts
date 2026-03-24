import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";


export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    const idInforme = `TERA-${Date.now()}`;
    return await ctx.db.insert("visitas", {
      idInforme,
      ...args,
      organizationId: user?.organizationId,
    });
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      // Compatibilidad: devolver sin filtro si no hay org (usuarios legacy)
      return await ctx.db.query("visitas").order("desc").collect();
    }
    return await ctx.db
      .query("visitas")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .order("desc")
      .collect();
  },
});

export const getByTipo = query({
  args: { tipoCliente: v.union(v.literal("CARTERA"), v.literal("POTENCIAL")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);

    const all = await ctx.db
      .query("visitas")
      .withIndex("by_tipo", (q) => q.eq("tipoCliente", args.tipoCliente))
      .order("desc")
      .collect();

    if (!user?.organizationId) return all;
    return all.filter((v) => v.organizationId === user.organizationId);
  },
});

export const update = mutation({
  args: {
    id: v.id("visitas"),
    tipoCliente: v.optional(v.union(v.literal("CARTERA"), v.literal("POTENCIAL"))),
    org: v.optional(v.string()),
    telefono: v.optional(v.string()),
    correo: v.optional(v.string()),
    autoridad: v.optional(v.string()),
    tecnicoPlanta: v.optional(v.string()),
    provincia: v.optional(v.string()),
    canton: v.optional(v.string()),
    caudal: v.optional(v.number()),
    horasOperacion: v.optional(v.number()),
    compliance: v.optional(v.number()),
    observaciones: v.optional(v.string()),
    params: v.optional(
      v.array(
        v.object({
          name: v.string(),
          raw: v.optional(v.number()),
          treated: v.optional(v.number()),
          limit: v.number(),
          ok: v.boolean(),
        })
      )
    ),
    dosages: v.optional(
      v.array(
        v.object({
          product: v.string(),
          mgL: v.string(),
          days: v.string(),
        })
      )
    ),
    comercial: v.optional(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("visitas") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
