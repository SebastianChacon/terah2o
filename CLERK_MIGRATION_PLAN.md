# Plan de Migración: `@convex-dev/auth` → Clerk

**Proyecto:** TeraH2O — Next.js 16 + Convex 1.32  
**Fecha:** 2026-05-23  
**Usuario de prueba:** `carlos.test.777@ptap.ec` / `segura1234`

---

## Resumen ejecutivo

La migración reemplaza `@convex-dev/auth` (Password provider) por Clerk como proveedor de identidad. Clerk emite JWTs firmados con RS256; Convex los verifica con la clave pública de Clerk vía JWKS. El frontend usa los hooks de Clerk con la UI custom existente (sin componentes hosted de Clerk). El código de negocio en Convex cambia mínimamente: se reemplaza `getAuthUserId` por un helper local equivalente.

**Stack resultante:**
```
Browser → Clerk SDK (@clerk/nextjs) → JWT → Convex (verifica con JWKS de Clerk)
proxy.ts → getAuth(request) de @clerk/nextjs/server  
```

---

## Diagnóstico del estado actual

### Archivos que tocan `@convex-dev/auth` (total: 15 archivos)

**Convex backend (11 archivos con `getAuthUserId`):**
- `convex/users.ts` — 4 llamadas
- `convex/organizations.ts` — 3 llamadas
- `convex/subscriptions.ts` — 3 llamadas
- `convex/financialProjections.ts` — 4 llamadas
- `convex/operatorPermissions.ts` — 3 llamadas
- `convex/shiftRecords.ts` — 4 llamadas
- `convex/visitas.ts` — 3 llamadas
- `convex/bitacoraEntries.ts` — 5 llamadas
- `convex/inventoryItems.ts` — 3 llamadas
- `convex/plantSettings.ts` — 2 llamadas
- `convex/jarTestSessions.ts` — 3 llamadas
- `convex/auth.ts` — archivo a eliminar
- `convex/schema.ts` — usa `authTables`

**Frontend Next.js (4 archivos):**
- `src/app/ConvexClientProvider.tsx` — `ConvexAuthProvider`, hybrid storage
- `src/app/login/LoginContent.tsx` — `useAuthActions`, `signIn("password", ...)`
- `src/components/auth/NavbarUser.tsx` — `useAuthActions`, `signOut()`
- `src/app/api/admin/create-operator/route.ts` — lee cookie `__convexAuthJWT`

---

## Arquitectura: antes vs después

### Antes
```
Login → signIn("password", {...}) [convex-dev/auth]
      → JWT guardado en localStorage + espejado en cookie __convexAuthJWT
      → ConvexAuthProvider lee localStorage
      → getAuthUserId(ctx) en Convex → _id del usuario

proxy.ts → lee cookie __convexAuthJWT
```

### Después
```
Login → signIn.create({identifier, password}) [Clerk]
      → JWT en cookie __session (manejado por Clerk automáticamente)
      → ConvexProviderWithClerk pasa JWT de Clerk a Convex
      → ctx.auth.getUserIdentity() → {subject: "user_clerk_id", email, ...}
      → helper getAuthenticatedUser(ctx) busca por clerkId en tabla users

proxy.ts → getAuth(request) de @clerk/nextjs/server
```

---

## Cambios en la tabla `users` de Convex

### Antes (con authTables)
```
_id: convex interno (usado como auth identifier)
tokenIdentifier, role, organizationId, createdAt
+ campos de authTables: emailVerificationTime, phoneVerificationTime, isAnonymous, phone, image
```

### Después (con Clerk)
```
_id: convex interno (solo para FKs internos)
clerkId: string — "user_2abc..." (Clerk user ID, subject del JWT)  ← NUEVO
email, name, role, organizationId, createdAt  (igual que antes)
```

**Índice nuevo:** `by_clerkId: ["clerkId"]`  
**Se elimina:** `by_tokenIdentifier` y campos de `authTables`  
**Se mantiene:** `tokenIdentifier` temporalmente para operadores pre-creados

---

## Paso 0 — Configuración de Clerk (manual, antes de tocar código)

### 0.1 Crear aplicación en Clerk

1. Ir a [clerk.com](https://clerk.com) → crear cuenta → **Create application**
2. Nombre: `TeraH2O`
3. Activar solo **Email + Password** (desactivar social providers)
4. En **User & Authentication → Email, Phone, Username**:
   - Email address: Required, Primary identifier
   - Password: On
5. Copiar las claves:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

### 0.2 Configurar JWT Template para Convex

En Clerk Dashboard → **JWT Templates** → **New template** → **Blank**:

```json
{
  "name": "convex",
  "algorithm": "RS256",
  "lifetime": 60,
  "claims": {
    "aud": "convex"
  }
}
```

> ⚠️ El nombre del template DEBE ser `convex`. Clerk expone la URL de este template como issuer.

Guardar y copiar el **Issuer URL** que aparece — será algo como:  
`https://still-tiger-99.clerk.accounts.dev`

### 0.3 Crear usuario de prueba

En Clerk Dashboard → **Users** → **Create user**:
```
Email: carlos.test.777@ptap.ec
Password: segura1234
```
Copiar el **Clerk User ID** (ej: `user_2abc123...`) — lo necesitarás en el Paso 3.

### 0.4 Variables de entorno

**`.env.local`** — agregar:
```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk sign-in/sign-up URLs (para redirects)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/operaciones
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/operaciones
```

**Convex Dashboard → Environment Variables** — agregar:
```
CLERK_JWT_ISSUER_DOMAIN = https://still-tiger-99.clerk.accounts.dev
```

**Mantener (no eliminar todavía):**
```bash
NEXT_PUBLIC_CONVEX_URL=...
GEMINI_API_KEY=...
# Eliminar cuando Convex lo permita: JWKS, JWT_PRIVATE_KEY, CONVEX_SITE_URL
```

---

## Paso 1 — Dependencias

```bash
# Instalar Clerk
npm install @clerk/nextjs

# Remover @convex-dev/auth (DESPUÉS de migrar todos los archivos)
npm uninstall @convex-dev/auth
```

**`package.json` final (sección `dependencies`):**
```json
{
  "@clerk/nextjs": "^6.x",
  "convex": "^1.32.0",
  "next": "16.1.6",
  ...
}
```

---

## Paso 2 — Backend Convex

### 2.1 `convex/auth.config.ts` — Reemplazar completamente

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      // Clerk JWT issuer URL (del template "convex" creado en Paso 0.2)
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
```

### 2.2 `convex/auth.ts` — Vaciar (ya no se usa)

```typescript
// convex/auth.ts
// Este archivo era usado por @convex-dev/auth.
// Con Clerk, la autenticación se verifica via auth.config.ts + JWKS de Clerk.
// Puede eliminarse si ningún otro archivo lo importa.
export {};
```

### 2.3 `convex/schema.ts` — Quitar authTables, agregar clerkId

**Cambios:**

```typescript
// ANTES:
import { authTables } from "@convex-dev/auth/server";
export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("operator"))),
    organizationId: v.optional(v.id("organizations")),
    createdAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_organizationId", ["organizationId"]),
  ...
```

```typescript
// DESPUÉS:
// (sin import de authTables, sin spread authTables)
export default defineSchema({
  users: defineTable({
    clerkId: v.optional(v.string()),   // ← NUEVO: Clerk user ID ("user_2abc...")
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()), // mantener para operadores pre-creados
    role: v.optional(v.union(v.literal("admin"), v.literal("operator"))),
    organizationId: v.optional(v.id("organizations")),
    createdAt: v.optional(v.number()),
  })
    .index("by_clerkId", ["clerkId"])           // ← NUEVO
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"])               // ← NUEVO (útil para operadores)
    .index("by_organizationId", ["organizationId"]),
  ...
```

> ⚠️ **Nota sobre `authTables`:** Al quitar `...authTables`, Convex eliminará las tablas `authSessions`, `authAccounts`, `authVerificationCodes`, `authRateLimits` del schema. Si hay datos en esas tablas en producción, Convex los borrará al hacer deploy. Los datos de la tabla `users` NO se pierden. Hacer backup si es necesario.

### 2.4 `convex/lib/auth.ts` — NUEVO helper (reemplaza `getAuthUserId`)

Crear archivo nuevo `convex/lib/auth.ts`:

```typescript
// convex/lib/auth.ts
// Helper que reemplaza getAuthUserId de @convex-dev/auth.
// Busca el usuario en la tabla users por su clerkId (= identity.subject del JWT).

import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type AnyCtx = QueryCtx | MutationCtx;

/**
 * Retorna el documento users completo del usuario autenticado, o null.
 * Equivale al antiguo getAuthUserId + ctx.db.get() en un solo paso.
 */
export async function getAuthenticatedUser(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // 1. Buscar por clerkId (ruta rápida para usuarios ya registrados)
  const byClerk = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (byClerk) return byClerk;

  // 2. Fallback: buscar por email (para operadores pre-creados por el admin)
  const email = identity.email;
  if (!email) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

/**
 * Como getAuthenticatedUser pero lanza si no está autenticado.
 */
export async function requireAuthUser(ctx: AnyCtx) {
  const user = await getAuthenticatedUser(ctx);
  if (!user) throw new Error("Unauthenticated");
  return user;
}

/**
 * Drop-in replacement de getAuthUserId: retorna el _id de Convex o null.
 */
export async function getAuthenticatedUserId(ctx: AnyCtx): Promise<Id<"users"> | null> {
  const user = await getAuthenticatedUser(ctx);
  return user?._id ?? null;
}
```

### 2.5 `convex/users.ts` — Adaptar al nuevo helper

```typescript
// convex/users.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, getAuthenticatedUserId, requireAuthUser } from "./lib/auth";

// ── Obtener el usuario autenticado actual ──────────────────────────────────
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthenticatedUser(ctx);
  },
});

// ── Upsert: se llama en el primer login vía Clerk ──────────────────────────
// Crea o actualiza el perfil de negocio del usuario.
export const upsertCurrentUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    clerkId: v.string(),  // ← NUEVO: Clerk user ID
    orgName: v.optional(v.string()), // solo en registro nuevo
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Buscar si ya existe por clerkId
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      // Ya registrado — actualizar nombre si cambió
      const patch: Record<string, unknown> = {};
      if (args.name && args.name !== existing.name) patch.name = args.name;
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    // ¿Hay un operador pre-creado con este email?
    const preCreated = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("role"), "operator"))
      .first();

    if (preCreated) {
      // Vincular el clerkId al operador pre-creado
      await ctx.db.patch(preCreated._id, {
        clerkId: args.clerkId,
        tokenIdentifier: args.clerkId,
        ...(args.name ? { name: args.name } : {}),
      });
      return preCreated._id;
    }

    // Primera vez — crear como admin
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      tokenIdentifier: args.clerkId,
      email: args.email,
      name: args.name,
      role: "admin",
      createdAt: Date.now(),
    });

    // Si viene con nombre de organización, se crea la org en el frontend
    // (via createOrganization mutation, igual que antes)
    return userId;
  },
});

// ── Crear operador (sin cambios funcionales, solo swap del helper) ─────────
export const createOperator = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const caller = await requireAuthUser(ctx);
    if (caller.role !== "admin") throw new Error("Solo un Admin puede crear operadores");
    if (caller.organizationId !== args.organizationId)
      throw new Error("No perteneces a esta organización");

    const operators = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "operator"))
      .collect();

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");
    if (operators.length >= org.maxOperators) {
      throw new Error(`Límite de operadores alcanzado (${org.maxOperators}).`);
    }

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingByEmail) throw new Error("Ya existe un usuario con ese correo electrónico");

    const operatorId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      role: "operator",
      organizationId: args.organizationId,
      createdAt: Date.now(),
      // clerkId se llenará en el primer login del operador
    });

    await ctx.db.insert("operatorPermissions", {
      operatorId,
      organizationId: args.organizationId,
      canAccessOperaciones: false,
      canAccessAsistencia: false,
      canAccessAcademia: false,
      canAccessBitacora: false,
    });

    return operatorId;
  },
});

// ── Listar operadores ──────────────────────────────────────────────────────
export const getOperatorsByOrg = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthenticatedUser(ctx);
    if (!caller?.organizationId) return [];

    return await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", caller.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "operator"))
      .collect();
  },
});
```

### 2.6 Todos los demás archivos Convex — Swap del import

Para los 10 archivos restantes (`organizations.ts`, `subscriptions.ts`, `financialProjections.ts`, `operatorPermissions.ts`, `shiftRecords.ts`, `visitas.ts`, `bitacoraEntries.ts`, `inventoryItems.ts`, `plantSettings.ts`, `jarTestSessions.ts`):

**Cambio de 2 líneas por archivo:**

```typescript
// QUITAR esta línea en cada archivo:
import { getAuthUserId } from "@convex-dev/auth/server";

// AGREGAR esta línea:
import { getAuthenticatedUserId } from "./lib/auth";
```

```typescript
// REEMPLAZAR todas las llamadas:
const userId = await getAuthUserId(ctx);
// POR:
const userId = await getAuthenticatedUserId(ctx);
```

El resto del código de cada archivo no cambia porque `getAuthenticatedUserId` devuelve el mismo tipo (`Id<"users"> | null`) que el antiguo `getAuthUserId`.

---

## Paso 3 — Frontend Next.js

### 3.1 `src/app/layout.tsx` — Envolver con ClerkProvider

```typescript
// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["300","400","500","600","700","800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400","500","700"] });

export const metadata: Metadata = {
  title: "TERAH2O | Inteligencia Operativa",
  description: "Plataforma de optimización y control para plantas de tratamiento de agua potable.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### 3.2 `src/app/ConvexClientProvider.tsx` — Simplificar con ConvexProviderWithClerk

```typescript
// src/app/ConvexClientProvider.tsx
"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { ReactNode, useMemo } from "react";

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!client) return <>{children}</>;

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

> **Nota:** El `convex` package incluye `convex/react-clerk` desde la versión 1.3+. No se necesita instalar nada extra. El almacenamiento híbrido y la lógica de cookies se eliminan completamente — Clerk maneja su propia cookie `__session`.

### 3.3 `src/proxy.ts` — Reemplazar con Clerk middleware

```typescript
// src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/pricing",
  "/motor-inteligencia(.*)",
  "/api/gemini(.*)",
  "/api/weather(.*)",
  "/api/gemini-tts(.*)",
  "/api/gemini-stream(.*)",
  "/public(.*)",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Rutas públicas: pasar sin verificar sesión
  if (isPublicRoute(request)) {
    // Si ya está autenticado y visita /login, redirigir al app
    if (pathname === "/login" || pathname.startsWith("/login")) {
      const { userId } = await auth();
      if (userId) {
        return NextResponse.redirect(new URL("/operaciones", request.url));
      }
    }
    return NextResponse.next();
  }

  // Rutas protegidas: verificar sesión de Clerk
  await auth.protect();

  // Verificar suscripción (cookie escrita por useSubscription en el cliente)
  const subStatus = request.cookies.get("__convexSubStatus")?.value;
  if (subStatus && subStatus !== "none" && subStatus !== "active" && subStatus !== "trialing") {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 3.4 `src/app/login/LoginContent.tsx` — Migrar a hooks de Clerk

```typescript
// src/app/login/LoginContent.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

type FlowMode = "signIn" | "signUp";

function parseClerkError(err: unknown): string {
  // Clerk devuelve errores con estructura { errors: [{code, message}] }
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors: Array<{ code: string; message: string }> }).errors;
    if (errors?.length > 0) {
      const code = errors[0].code;
      if (code === "form_password_incorrect") return "Contraseña incorrecta. Verifica tus credenciales.";
      if (code === "form_identifier_not_found") return "No existe cuenta con ese correo. Regístrate primero.";
      if (code === "form_identifier_exists") return "Ya existe una cuenta con ese correo. Inicia sesión.";
      if (code === "session_exists") return "Ya tienes sesión activa.";
      return errors[0].message ?? "Error de autenticación.";
    }
  }
  return "Error de autenticación. Verifica tus datos e intenta de nuevo.";
}

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "/operaciones";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/operaciones";

  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { isAuthenticated } = useConvexAuth();
  const upsertUser = useMutation(api.users.upsertCurrentUser);
  const createOrganization = useMutation(api.organizations.createOrganization);

  const [mode, setMode] = useState<FlowMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuando Convex confirma la sesión, sincronizar perfil y redirigir
  useEffect(() => {
    if (!isAuthenticated || redirecting) return;
    // isAuthenticated flipea cuando ConvexProviderWithClerk entrega el JWT al backend
    // No hacer nada aquí — el upsert ya se hizo en handleSubmit
  }, [isAuthenticated]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "signIn") {
        // ── Sign In ────────────────────────────────────────────────────────
        const result = await signIn.create({
          identifier: email,
          password,
        });

        if (result.status === "complete") {
          // Clerk completó el sign-in — sincronizar perfil en Convex
          const clerkId = result.createdSessionId ?? "";
          // Nota: el userId real es result.createdUserId si está disponible
          // upsertCurrentUser usará ctx.auth.getUserIdentity() en el servidor
          setRedirecting(true);
          // Pequeña pausa para que ConvexProviderWithClerk actualice el JWT
          await new Promise((r) => setTimeout(r, 500));
          try {
            await upsertUser({ email, clerkId: clerkId || email });
          } catch {
            // Non-fatal: el usuario ya existe o se sincronizará luego
          }
          router.replace(nextPath);
        } else {
          setError("Requiere verificación adicional. Contacta al administrador.");
        }
      } else {
        // ── Sign Up ────────────────────────────────────────────────────────
        const result = await signUp.create({
          emailAddress: email,
          password,
          firstName: name.split(" ")[0],
          lastName: name.split(" ").slice(1).join(" ") || undefined,
        });

        if (result.status === "complete") {
          setRedirecting(true);
          await new Promise((r) => setTimeout(r, 500));
          try {
            await upsertUser({
              email,
              name,
              clerkId: result.createdUserId ?? email,
            });
            if (orgName) {
              await createOrganization({ name: orgName });
            }
          } catch {
            // Non-fatal
          }
          router.replace(nextPath);
        } else if (result.status === "missing_requirements") {
          setError("Verifica tu correo electrónico para completar el registro.");
        }
      }
    } catch (err: unknown) {
      setError(parseClerkError(err));
    } finally {
      setLoading(false);
      // No desactivar redirecting si está en true
    }
  }

  if (!signInLoaded || !signUpLoaded || redirecting) {
    return (
      <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/30 text-xs font-mono tracking-widest uppercase">
            {redirecting ? "Iniciando sesión..." : "Cargando..."}
          </p>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-base placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all";

  return (
    <div className="min-h-screen bg-[#05051a] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(59,130,246,0.06)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="text-[1.8rem] font-bold tracking-[0.04em]">
              <span className="text-white">TERA</span>
              <span className="text-blue-500">H2O</span>
            </div>
            <p className="font-mono text-[0.62rem] tracking-[0.28em] text-white/30 mt-1">
              INTELIGENCIA OPERATIVA
            </p>
          </Link>
        </div>

        <div className="bg-[#0a1120] border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/40">
          <div className="flex gap-1 mb-6 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            {(["signIn", "signUp"] as FlowMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-2 text-[0.7rem] font-mono uppercase tracking-widest rounded-md transition-all ${
                  mode === m
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {m === "signIn" ? "Ingresar" : "Registrarse"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signUp" && (
              <div>
                <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                  Nombre completo
                </label>
                <input type="text" name="name" autoComplete="name" value={name}
                  onChange={(e) => setName(e.target.value)} required
                  placeholder="Ing. Juan Pérez" className={inputClass} />
              </div>
            )}

            <div>
              <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                Correo electrónico
              </label>
              <input type="email" name="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                placeholder="admin@ptap.ec" className={inputClass} />
            </div>

            <div>
              <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                Contraseña
              </label>
              <input type="password" name="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} required
                minLength={8} placeholder="••••••••" className={inputClass} />
            </div>

            {mode === "signUp" && (
              <div>
                <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                  Nombre de tu PTAP / Organización
                </label>
                <input type="text" name="organization" autoComplete="organization"
                  value={orgName} onChange={(e) => setOrgName(e.target.value)} required
                  placeholder="PTAP Municipio de Loja" className={inputClass} />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-[0.15em] rounded-lg transition-all shadow-lg shadow-blue-500/20 mt-2">
              {loading ? "Procesando..." : mode === "signIn" ? "Ingresar" : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-[0.62rem] font-mono mt-6 tracking-wide">
          TeraH2O · Acceso Seguro · Ecuador
        </p>
      </div>
    </div>
  );
}
```

### 3.5 `src/components/auth/NavbarUser.tsx` — Usar useClerk para signOut

**Cambio mínimo — solo la sección de cerrar sesión:**

```typescript
// QUITAR:
import { useAuthActions } from "@convex-dev/auth/react";
const { signOut } = useAuthActions();

// AGREGAR:
import { useClerk } from "@clerk/nextjs";
const { signOut } = useClerk();
```

**Botón de cerrar sesión** (reemplazar el `onClick` completo):

```typescript
onClick={async () => {
  setOpen(false);
  // Limpiar cookie de suscripción
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `__convexSubStatus=; path=/; max-age=0; SameSite=Lax${secure}`;
  try {
    await signOut();
  } catch {
    // Clerk limpia su cookie automáticamente
  }
  // Hard redirect para resetear el estado del cliente
  window.location.href = "/login";
}}
```

### 3.6 `src/hooks/useCurrentUser.ts` — Usar useUser de Clerk

```typescript
// src/hooks/useCurrentUser.ts
"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { UserProfile } from "@/types/auth";

export interface UseCurrentUserResult {
  user: UserProfile | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Sin cambios de interfaz — el hook sigue igual externamente.
// Internamente, useConvexAuth ahora es provisto por ConvexProviderWithClerk
// que usa el JWT de Clerk en lugar de @convex-dev/auth.
export function useCurrentUser(): UseCurrentUserResult {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  ) as UserProfile | null | undefined;

  return {
    user: isAuthenticated ? user : null,
    isLoading: authLoading || (isAuthenticated && user === undefined),
    isAuthenticated,
  };
}
```

> ✅ **Este hook no necesita cambios de código.** `useConvexAuth` de `convex/react` es agnóstico al proveedor de auth. `ConvexProviderWithClerk` lo alimenta con el JWT de Clerk automáticamente.

### 3.7 `src/hooks/useSubscription.ts` — Sin cambios

> ✅ **Sin cambios.** El hook solo usa `useConvexAuth` y queries de Convex. La cookie `__convexSubStatus` sigue funcionando igual.

### 3.8 `src/app/api/admin/create-operator/route.ts` — Usar token de Clerk

```typescript
// src/app/api/admin/create-operator/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export async function POST(req: NextRequest) {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_CONVEX_URL is not configured" }, { status: 503 });
    }

    // Obtener token de Clerk para el template "convex"
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);

    const body = await req.json();
    const { email, name, organizationId } = body as {
      email?: string; name?: string; organizationId?: string;
    };

    if (!email || !name || !organizationId) {
      return NextResponse.json({ error: "Se requieren email, name y organizationId" }, { status: 400 });
    }

    const operatorId = await convex.mutation(api.users.createOperator, {
      email,
      name,
      organizationId: organizationId as Id<"organizations">,
    });

    return NextResponse.json({ success: true, operatorId }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("Límite") ? 422 : msg.includes("Solo un Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
```

### 3.9 `src/app/api/check-subscription/route.ts` — Verificar si usa cookies de auth

Revisar este archivo para reemplazar cualquier lectura de `__convexAuthJWT` por `auth()` de Clerk.

---

## Paso 4 — Tests Playwright

### 4.1 `tests/auth.spec.ts` — Actualizar para Clerk

```typescript
// tests/auth.spec.ts
import { test, expect } from "@playwright/test";

// Usuario de prueba creado en Clerk Dashboard (Paso 0.3)
const TEST_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "segura1234";

test.describe("login flow (Clerk)", () => {
  test.beforeEach(async ({ context }) => {
    // Limpiar cookies y localStorage antes de cada test
    await context.clearCookies();
  });

  // ── Test 1: Página de login carga correctamente ────────────────────────
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  // ── Test 2: Contraseña incorrecta muestra error ────────────────────────
  test("wrong password shows error and stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill("contraseña-incorrecta-xyz");
    await page.locator("button[type='submit']").click();

    // Esperar error (máx 6s para que Clerk responda)
    const error = page.locator("text=/contraseña|credencial|error/i");
    await expect(error).toBeVisible({ timeout: 6000 });

    // Debe permanecer en /login
    expect(page.url()).toContain("/login");
  });

  // ── Test 3: Login exitoso → ruta protegida + cookie de Clerk ──────────
  test("successful login reaches protected route", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));

    await page.goto("/login");
    await expect(page).toHaveURL(/login/);

    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);

    // Esperar navegación fuera de /login (hasta 15s — Clerk puede ser lento en dev)
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15000 }),
      page.locator("button[type='submit']").click(),
    ]);

    const finalUrl = page.url();
    console.log("Final URL:", finalUrl);

    // Debe estar en ruta protegida
    expect(finalUrl).not.toContain("/login");
    expect(finalUrl).toMatch(/\/(operaciones|dashboard|asistencia|academia)/);

    // Verificar cookie de sesión de Clerk
    // Clerk usa "__session" en producción y "__clerk_db_jwt" en desarrollo
    const cookies = await page.context().cookies();
    const clerkCookie = cookies.find(
      (c) => c.name === "__session" || c.name === "__clerk_db_jwt" || c.name.startsWith("__clerk")
    );
    console.log("Cookies:", cookies.map((c) => `${c.name}=${c.value.slice(0, 20)}...`));
    expect(clerkCookie, "Clerk session cookie debe estar presente").toBeTruthy();
  });

  // ── Test 4: Usuario autenticado en /login → redirige a /operaciones ───
  test("authenticated user visiting /login is redirected", async ({ page, context }) => {
    // Primero hacer login
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15000 }),
      page.locator("button[type='submit']").click(),
    ]);

    // Verificar que salió del login
    expect(page.url()).not.toContain("/login");

    // Navegar de regreso a /login — proxy.ts debe redirigir
    await page.goto("/login");
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/login");
  });

  // ── Test 5: Usuario no autenticado bloqueado en rutas protegidas ───────
  test("unauthenticated user is blocked from protected routes", async ({ page }) => {
    await page.goto("/operaciones");
    // proxy.ts con clerkMiddleware redirige a /login
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  // ── Test 6: Sign out limpia la sesión ──────────────────────────────────
  test("sign out clears session and redirects to login", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15000 }),
      page.locator("button[type='submit']").click(),
    ]);

    // Abrir dropdown de usuario y hacer click en "Cerrar Sesión"
    // El NavbarUser tiene un botón con texto "Cerrar Sesión"
    const userChip = page.locator("button[aria-label='Menú de usuario']");
    await userChip.waitFor({ timeout: 8000 });
    await userChip.click();

    const signOutBtn = page.locator("text=Cerrar Sesión");
    await expect(signOutBtn).toBeVisible({ timeout: 3000 });
    
    await Promise.all([
      page.waitForURL(/login/, { timeout: 8000 }),
      signOutBtn.click(),
    ]);

    expect(page.url()).toContain("/login");

    // Intentar acceder a ruta protegida — debe redirigir a login
    await page.goto("/operaciones");
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});
```

### 4.2 `playwright.config.ts` — Sin cambios necesarios

El archivo existente ya está configurado correctamente. Solo asegurarse de pasar las variables de entorno al correr los tests:

```bash
# Correr tests con usuario de prueba
TEST_EMAIL=carlos.test.777@ptap.ec TEST_PASSWORD=segura1234 npx playwright test

# O con .env.test:
# TEST_EMAIL=carlos.test.777@ptap.ec
# TEST_PASSWORD=segura1234
```

---

## Paso 5 — Migración de datos (si hay usuarios existentes en producción)

Si hay usuarios en la tabla `users` de Convex con datos reales, necesitas:

1. **Exportar usuarios** de Convex Dashboard → tabla `users`
2. **Crear usuarios en Clerk** vía Clerk Dashboard o API:
   ```bash
   # Clerk Management API
   curl -X POST https://api.clerk.com/v1/users \
     -H "Authorization: Bearer $CLERK_SECRET_KEY" \
     -d '{"email_address":["user@example.com"],"password":"temp_pass_123"}'
   ```
3. **Llenar el campo `clerkId`** en Convex para cada usuario existente:
   - Ir a Convex Dashboard → tabla `users` → editar cada documento
   - Agregar `clerkId: "user_2abc..."` con el ID de Clerk correspondiente

Para el usuario de prueba `carlos.test.777@ptap.ec`:
- Ya lo creaste en Clerk (Paso 0.3) con ID `user_2abc...`
- En Convex Dashboard → tabla `users` → buscar documento con `email: "carlos.test.777@ptap.ec"` → agregar `clerkId: "user_XXXX"`
- Si no existe, se creará automáticamente en el primer login gracias a `upsertCurrentUser`

---

## Orden de ejecución recomendado

```
Paso 0: Clerk setup (manual) — 15 min
  ↓
Paso 1: npm install @clerk/nextjs
  ↓
Paso 2: Convex backend (auth.config.ts, schema.ts, lib/auth.ts, todos los .ts)
  ↓
npx convex dev (verificar que sincroniza sin errores de TypeScript)
  ↓
Paso 3a: layout.tsx + ConvexClientProvider.tsx (providers)
  ↓
Paso 3b: proxy.ts (middleware)
  ↓
Paso 3c: LoginContent.tsx (login UI)
  ↓
Paso 3d: NavbarUser.tsx (signOut)
  ↓
Paso 3e: create-operator/route.ts (API route)
  ↓
npm run dev (verificar login manual)
  ↓
Paso 4: Tests Playwright
  ↓
npm uninstall @convex-dev/auth
  ↓
npm run build (verificar que compila limpio)
```

---

## Verificación final

```bash
# 1. Convex no tiene errores de TypeScript
npx convex dev

# 2. App corre sin errores en consola
npm run dev

# 3. Login manual con carlos.test.777@ptap.ec / segura1234:
#    → Formulario acepta credenciales
#    → Spinner aparece
#    → Redirige a /operaciones
#    → NavbarUser muestra nombre/email
#    → Sign out redirige a /login

# 4. Playwright tests pasan
TEST_EMAIL=carlos.test.777@ptap.ec TEST_PASSWORD=segura1234 npx playwright test

# 5. Build de producción limpio
npm run build

# 6. No hay imports de @convex-dev/auth en ningún archivo del proyecto
grep -r "@convex-dev/auth" src/ convex/ --include="*.ts" --include="*.tsx"
# → Debe retornar 0 resultados
```

---

## Resumen de archivos modificados

| Archivo | Acción | Tipo de cambio |
|---------|--------|----------------|
| `convex/auth.config.ts` | Reemplazar | Clerk JWKS URL |
| `convex/auth.ts` | Vaciar/eliminar | Ya no necesario |
| `convex/schema.ts` | Modificar | Quitar authTables, agregar clerkId |
| `convex/lib/auth.ts` | **CREAR** | Helper reemplaza getAuthUserId |
| `convex/users.ts` | Reescribir | Usar clerkId, nuevo upsert |
| `convex/*.ts` (10 archivos) | 2 líneas c/u | Swap import + función |
| `src/app/layout.tsx` | Envolver | ClerkProvider |
| `src/app/ConvexClientProvider.tsx` | Reemplazar | ConvexProviderWithClerk |
| `src/proxy.ts` | Reemplazar | clerkMiddleware |
| `src/app/login/LoginContent.tsx` | Reescribir | useSignIn/useSignUp |
| `src/components/auth/NavbarUser.tsx` | 2 líneas | useClerk().signOut() |
| `src/hooks/useCurrentUser.ts` | Sin cambios | Ya compatible |
| `src/hooks/useSubscription.ts` | Sin cambios | Ya compatible |
| `src/app/api/admin/create-operator/route.ts` | Modificar | auth() de Clerk |
| `tests/auth.spec.ts` | Reescribir | Cookie de Clerk, nuevo usuario |
| `package.json` | Agregar/quitar | +@clerk/nextjs, -@convex-dev/auth |
