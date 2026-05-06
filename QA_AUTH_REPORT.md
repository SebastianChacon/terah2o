# QA Auth Report — TeraH2O
> Revisión completa del área de login/auth. Fecha: 2026-05-05
> **Actualización: 2026-05-06 — todos los bugs resueltos. Test E2E aprobado.**

---

## ✅ Estado final: CERRADO — todos los bugs corregidos y verificados

Test end-to-end realizado en `http://localhost:3000` con usuario `carlos.test.777@ptap.ec`:

| Caso | Resultado |
|------|-----------|
| Login con credenciales válidas | ✅ Redirige a `/operaciones` |
| Usuario visible en navbar con rol y plan | ✅ "Ing. Carlos… · TRIAL · ADMINISTRADOR" |
| Logout → cookie JWT destruida, redirect a `/login` | ✅ |
| Acceder a `/operaciones` sin sesión | ✅ Redirige a `/login?next=%2Foperaciones` |
| Acceder a `/dashboard/admin` sin sesión | ✅ Redirige a `/login?next=%2Fdashboard%2Fadmin` |
| Login con `?next=` → vuelve a la página solicitada | ✅ Aterrizó en `/dashboard/admin` |

---

## Bugs — historial (4 resueltos)

### 🔴 [CRÍTICO] `convex/users.ts` — Todos los usuarios nuevos reciben `role: "admin"`

**Archivo:** `convex/users.ts`, función `upsertCurrentUser`, líneas ~42-48

**Problema:**
```typescript
// ACTUAL — incorrecto
await ctx.db.patch(userId, {
  tokenIdentifier: userId,
  role: "admin",   // ← hardcodeado para TODOS
  createdAt: Date.now(),
});
```

Dos consecuencias:
1. Cualquier persona que use el Sign Up obtiene rol admin.
2. El flujo de operadores está roto: `createOperator` pre-inserta un doc con `role: "operator"` y `tokenIdentifier: "pending_${email}"`, sin cuenta de auth. Cuando el operador se registra en el formulario público, Convex Auth crea un doc NUEVO y `upsertCurrentUser` le asigna `role: "admin"`. El doc pre-creado queda huérfano. El operador termina siendo admin.

**Fix requerido:**
Antes de asignar el rol, buscar si ya existe un registro de operador pre-creado con ese email y, si existe, usar ese documento en lugar de crear uno nuevo (o asignar `role: "operator"`). Ejemplo de lógica:

```typescript
// En upsertCurrentUser, reemplazar el bloque "Primera vez":
// Buscar si hay un registro de operador pre-creado con este email
const existingOperator = await ctx.db
  .query("users")
  .filter((q) => q.eq(q.field("email"), args.email))
  .filter((q) => q.eq(q.field("role"), "operator"))
  .first();

const roleToAssign = existingOperator ? "operator" : "admin";
const orgId = existingOperator?.organizationId;

await ctx.db.patch(userId, {
  tokenIdentifier: userId,
  role: roleToAssign,
  createdAt: Date.now(),
  ...(orgId ? { organizationId: orgId } : {}),
  ...(args.name ? { name: args.name } : {}),
});

// Si había un doc huérfano de operador, eliminarlo para evitar duplicados
if (existingOperator) {
  await ctx.db.delete(existingOperator._id);
  // También migrar sus operatorPermissions al nuevo userId
  const perms = await ctx.db
    .query("operatorPermissions")
    .filter((q) => q.eq(q.field("operatorId"), existingOperator._id))
    .first();
  if (perms) {
    await ctx.db.patch(perms._id, { operatorId: userId });
  }
}
```

---

### 🟠 [MEDIO] `src/app/login/LoginContent.tsx` — Open redirect bypass via `//evil.com`

**Archivo:** `src/app/login/LoginContent.tsx`, línea 51

**Problema:**
```typescript
// ACTUAL — incompleto
const nextPath = rawNext.startsWith("/") ? rawNext : "/operaciones";
// "//evil.com" empieza con "/" → pasa el check (protocol-relative URL)
```

**Fix de una línea:**
```typescript
// CORRECTO
const nextPath =
  rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/operaciones";
```

---

### 🟠 [MEDIO] `convex/organizations.ts` — `maxOperators: 5` incorrecto para plan Starter

**Archivo:** `convex/organizations.ts`, función `createOrganization`, línea ~26

**Problema:**
```typescript
// ACTUAL — incorrecto
const orgId = await ctx.db.insert("organizations", {
  maxOperators: 5,  // límite del plan Pro, no del Starter
  ...
});
// La suscripción se crea como plan: "starter" (debe ser máx 3 operadores)
```

Según la tabla de pricing: Starter = 1 Admin + 3 Op, Pro = 1 Admin + 5 Op.

**Fix:**
```typescript
// CORRECTO
const orgId = await ctx.db.insert("organizations", {
  maxOperators: 3,  // Starter trial: 1 admin + 3 operadores
  ...
});
```

---

### 🟡 [BAJO] `src/components/auth/NavbarUser.tsx` — Logout sin flag `Secure`

**Archivo:** `src/components/auth/NavbarUser.tsx`, líneas 130-132

**Problema:**
```typescript
// ACTUAL — falta "; Secure" en HTTPS
document.cookie = "__convexAuthJWT=; path=/; max-age=0; SameSite=Lax";
document.cookie = "__convexAuthRefreshToken=; path=/; max-age=0; SameSite=Lax";
document.cookie = "__convexSubStatus=; path=/; max-age=0; SameSite=Lax";
```
Las cookies fueron creadas con `; Secure` en HTTPS pero se borran sin ese flag. Inconsistente con el resto del código.

**Fix:**
```typescript
// CORRECTO
const secure = location.protocol === "https:" ? "; Secure" : "";
document.cookie = `__convexAuthJWT=; path=/; max-age=0; SameSite=Lax${secure}`;
document.cookie = `__convexAuthRefreshToken=; path=/; max-age=0; SameSite=Lax${secure}`;
document.cookie = `__convexSubStatus=; path=/; max-age=0; SameSite=Lax${secure}`;
```

---

## Contexto: bugs ya corregidos (no tocar)

Los siguientes fueron resueltos en commits recientes y están bien:
- `middleware.ts` ahora existe y exporta el proxy correctamente
- Mensajes de error de auth en español (códigos `InvalidSecret`, `AccountAlreadyExists`, etc.)
- Flag `Secure` en cookie JWT en HTTPS
- Flag `Secure` en cookie `__convexSubStatus` en HTTPS
- Spinner durante `authLoading` y `redirecting`
- `font-size: 16px` en inputs (evita auto-zoom iOS Safari)
- `autoComplete` y `name` en todos los inputs del formulario
- Suspense fallback del login con spinner real
- Open redirect base corregido (el bypass de `//` es lo que falta)

---

## Orden de prioridad recomendado

1. **`convex/users.ts`** — el más crítico, afecta seguridad de roles
2. **`LoginContent.tsx`** — una línea de fix
3. **`convex/organizations.ts`** — una línea de fix
4. **`NavbarUser.tsx`** — cosmético pero consistente con el resto
