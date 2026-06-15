# Panel Owner (`/owner`) — Contrato funcional

Documento de referencia de **cómo debe funcionar** cada función del panel Owner
(super-admin global). Sirve de contrato para los tests E2E (`tests/owner.spec.ts`)
y para diagnosticar regresiones.

> Alcance: GLOBAL (todas las organizaciones). Acceso por **un solo correo**
> definido en `SUPER_ADMIN_EMAIL` (env del deployment de Convex, no basta `.env.local`).

---

## 1. Gate de acceso

| Pieza | Comportamiento esperado |
|---|---|
| `convex/superAdmin.ts → amISuperAdmin` (query) | Devuelve `true` solo si el correo autenticado (`users.email` o `identity.email`, normalizado a minúsculas/trim) === `SUPER_ADMIN_EMAIL`. **Nunca lanza.** Si no hay env var → `false` (nadie entra). |
| `src/app/owner/page.tsx` | `undefined` → spinner. `false` → pantalla "Acceso denegado". `true` → `<OwnerShell />`. |
| `requireSuperAdmin` | Helper que lanza `"No autorizado"` si `isSuperAdmin` es falso. Toda query/mutation del panel lo invoca **primero**. |
| `src/proxy.ts` | `/owner` y `/api/owner` requieren login (Clerk) pero **saltan** el gate de suscripción. |

**Casos límite que deben cumplirse**
- Operador NO-owner → "Acceso denegado"; el panel no se filtra (ni dashboard ni navegación).
- `SUPER_ADMIN_EMAIL` ausente en el deployment de Convex → nadie entra, ni siquiera el dueño.

---

## 2. Resumen ejecutivo (Dashboard)

`getOwnerDashboard` (query) → métricas globales:

- `totalOrgs`, `totalAccounts`, `totalAdmins`, `totalOperators`.
- `subsByStatus` / `subsByPlan`: cuenta **la última suscripción por org** (mayor `createdAt`).
- `mrr`: suma de precios de plan (`starter=49`, `pro=89`) **solo** de suscripciones `active`. Es estimado (no hay pasarela de pago real).
- `trialsExpiring`: trials que vencen en ≤ 7 días, ordenados por fecha ascendente.

**Esperado:** la vista por defecto es "Resumen ejecutivo" y muestra "MRR estimado" y conteo de organizaciones.

---

## 3. Organizaciones

`listOrganizations` (query) → orgs enriquecidas (dueño, conteos, última suscripción), ordenadas por nombre.

| Acción UI | Mutation | Reglas / errores esperados |
|---|---|---|
| Renombrar org | `renameOrganizationGlobal` | Nombre no vacío (trim). Org debe existir. |
| Cambiar cupo de operadores | `setMaxOperators` | Entero ≥ 1. **No** puede ser menor que el nº de operadores actuales. |
| Transferir propiedad | `transferOrgOwnership` | El nuevo dueño debe pertenecer a la org **y** ser `admin`. |
| Editar suscripción (inline) | `setSubscriptionGlobal` | Ver §5. |
| **Eliminar org completa** | `deleteOrganizationGlobal` (vía `/api/owner/delete-org`) | Cascada: borra datos de negocio (7 tablas `by_organizationId`), permisos, suscripciones, usuarios y el doc org. **Guard:** no puede borrar la org a la que pertenece el propio owner. Devuelve `{clerkIds}` para limpieza en Clerk. |

---

## 4. Cuentas

`listAllUsers` (query) → todas las cuentas (rol, org, suscripción, permisos). Admins → `permissions: null` ("Acceso total"). Operadores → 8 flags.

### 4.1 Buscar / filtrar
Búsqueda por nombre/correo/org (case-insensitive). Filtros: Todos / Admins / Operadores.

### 4.2 Cambiar rol — `setUserRoleGlobal`
- Promover operador→admin: elimina su fila de `operatorPermissions` (admin = acceso total por diseño).
- Degradar admin→operador: crea permisos default (todo en `false`).
- **Guard:** no puede cambiar el rol del **dueño** de la org (botón deshabilitado en UI + error en backend).

### 4.3 Permisos de operador — `setPermissionsGlobal` (`PermissionGrid`)
- Toggle optimista: actualiza UI, llama mutation; si falla, **revierte** y muestra error.
- Persiste tras recargar.
- Sub-módulos de Operaciones quedan **bloqueados** si `canAccessOperaciones = false`.

### 4.4 Eliminar cuenta individual — `deleteUserGlobal` (vía `/api/owner/delete-user`)

Flujo: `AccountsView.confirmDelete` → `fetch DELETE /api/owner/delete-user {userId}`
→ ruta obtiene token Clerk (template `convex`) → `ConvexHttpClient.setAuth` →
`deleteUserGlobal` → limpieza best-effort en Clerk.

**`deleteUserGlobal` (Convex) — fuente de verdad del borrado:**
- `requireSuperAdmin` primero.
- Usuario debe existir.
- **Guard 1:** no puede borrarse a sí mismo (el owner).
- **Guard 2:** no puede borrar al `adminUserId` dueño de una org (evita orfanar la org).
- Borra `operatorPermissions` asociados, luego el doc `users`.
- Devuelve `{clerkId, email}`.

**Ruta API — contrato de respuesta:**
- Sin token Clerk → `401 {error:"No autenticado"}`.
- Sin `userId` → `400`.
- Mutation lanza `"No autorizado"` → `403`; otro error → `500`.
- **Éxito** → `200 {success:true, clerkCleaned:boolean}`.
- **Invariante crítico:** una vez que Convex borró el usuario, la ruta **nunca** devuelve error
  por un fallo de Clerk. La limpieza de Clerk es **best-effort** (`cleanupClerkAccount` nunca lanza).
  Si Clerk falla, responde `200 {success:true, clerkCleaned:false, warning:"…"}`.

**UI esperada:**
- Botón eliminar **deshabilitado** (con icono de candado) para el owner y para el dueño de cualquier org.
- Confirmación vía `ConfirmDialog` (variante danger) antes de borrar.
- Éxito → toast "Cuenta de {name} eliminada"; la fila desaparece (query reactiva).
- `warning` presente → se muestra como toast de error con el texto del warning (la cuenta sí se borró de la DB, solo quedó residuo en Clerk).

> **Bug histórico corregido:** antes la limpieza de Clerk (`getUserList`/`deleteUser`) corría sin
> aislamiento; si Clerk fallaba tras un borrado exitoso en Convex, la ruta devolvía `500` y la UI
> mostraba "Error al eliminar cuenta" pese a que la cuenta **ya estaba borrada** (estado
> inconsistente + mensaje engañoso). Ahora la limpieza es best-effort y reporta `warning`.

---

## 5. Suscripciones

`SubscriptionsView` → un `SubscriptionEditor` por org. Campos: estado, plan, fin de trial, vencimiento.

`setSubscriptionGlobal`:
- Parchea la última suscripción de la org; si no existe, la crea con `createdAt = now`.
- Idempotente: guardar sin cambios → toast "Suscripción de {org} actualizada" (no destructivo).

---

## 6. Nuevo cliente (onboarding)

`CreateClientModal` → `POST /api/owner/create-client` → `createClientOrg`:
- Valida orgName/adminName/adminEmail no vacíos; correo único (si existe → `422 "Ya existe"`).
- Crea `users(admin)` + `organizations` (maxOperators=3, admin como dueño) + `subscriptions(trialing/starter, trial 14 días)`.
- El admin se pre-registra; su `clerkId` se vincula en el primer login.
- Envía correo de invitación (best-effort; el resultado se reporta como `emailSent`).

---

## 7. Cobertura E2E (`tests/owner.spec.ts`)

| # | Test | Verifica |
|---|---|---|
| 1 | Operador no-owner ve "Acceso denegado" | Gate §1 |
| 2 | Owner ve dashboard + métricas; su cuenta aparece en Cuentas | §1, §2, §4 |
| 3 | Toggle de permiso persiste tras recargar | §4.3 |
| 4 | Botón eliminar del owner/dueño está deshabilitado | §4.4 guards |
| 5 | Editar y guardar suscripción (idempotente) | §5 |
| 6 | **Eliminar una cuenta de operador → desaparece de la lista** | §4.4 camino feliz |
| 7 | Crear cliente y eliminar la org (limpia tras sí) | §3, §6 |

El test #6 usa `seedDisposableOperator` (endpoint dev-only `/test/seed-operator` en
`convex/http.ts`) para crear un operador **solo en Convex** (sin cuenta Clerk), de modo que el
borrado sea limpio y aislado.

### Cómo correr la suite
```bash
# Terminal 1
npx convex dev
# Terminal 2
npm run dev
# Terminal 3 (requiere .env.local con CLERK_SECRET_KEY y, en Convex, SUPER_ADMIN_EMAIL = TEST_EMAIL)
npx playwright test tests/owner.spec.ts
```
