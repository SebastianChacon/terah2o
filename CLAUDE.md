# TeraH2O — Contexto del Proyecto para Claude

## Descripción General

TeraH2O es una plataforma SaaS de inteligencia operacional para plantas de tratamiento de agua potable (PTAP). Permite a operadores de agua gestionar dosificación química, inventario, finanzas, vigilancia de calidad del agua (INEN 1108) y formación. Lista para entrega comercial.

**Stack:** Next.js 16 (App Router) + Convex 1.32 (backend/DB tiempo real) + Tailwind CSS 4 + TypeScript

**Convex project:** `clear-albatross-368` — `https://clear-albatross-368.convex.cloud`

---

## Estructura del Proyecto

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Home / Landing
│   ├── login/page.tsx          # Autenticación (sign-in / sign-up)
│   ├── pricing/page.tsx        # Planes Starter ($49) y Pro ($89)
│   ├── motor-inteligencia/     # Predicción turbidez (ruta pública)
│   ├── operaciones/
│   │   ├── page.tsx            # Hub Operaciones (4 módulos)
│   │   ├── consola-tecnica/    # Jar-test, dosificación, IA
│   │   ├── hoja-operativa/     # Registro turnos y parámetros agua
│   │   ├── stock/              # Inventario químico y kardex
│   │   ├── finanzas/           # OPEX, proyecciones, costo/m³
│   │   └── bitacora/           # Auditoría y visualización de datos
│   ├── asistencia/             # Consola de Vigilancia de Calidad del Agua (INEN 1108/TULSMA) — ruta /asistencia
│   ├── academia/               # Módulos educativos (4 módulos)
│   ├── dashboard/
│   │   ├── profile/            # Perfil usuario y suscripción
│   │   └── admin/              # Gestión operadores y permisos (scoped a la org)
│   ├── owner/                  # Panel Owner (super-admin GLOBAL) — enlace secreto
│   └── api/
│       ├── gemini/route.ts     # Google Gemini 2.5 Flash (IA) — modelo: gemini-2.5-flash
│       ├── gemini-tts/route.ts # TTS — modelo: gemini-2.5-flash-preview-tts
│       ├── weather/route.ts    # OpenWeatherMap API
│       ├── check-subscription/ # Verificar suscripción
│       ├── admin/              # Crear operadores, permisos (scoped a la org)
│       └── owner/              # delete-user — borrar cualquier cuenta (Convex + Clerk)
├── components/
│   ├── ui/                     # Card, Toast, InputField, SelectField, etc.
│   ├── auth/                   # AuthGuard, NavbarUser, SubscriptionModal
│   ├── layout/                 # Footer
│   ├── ai/                     # AiButton
│   └── fab/                    # WhatsAppFab
├── hooks/
│   ├── useCurrentUser.ts       # Usuario autenticado actual
│   ├── useConvex.ts            # useSafeQuery / useSafeMutation (no-op si no hay URL)
│   ├── useSubscription.ts      # Estado suscripción + cookie __convexSubStatus
│   ├── usePermissions.ts       # Permisos por módulo del operador
│   ├── useGemini.ts            # Llama a /api/gemini
│   ├── useGeminiTts.ts         # Llama a /api/gemini-tts
│   ├── useWeather.ts           # Llama a /api/weather
│   └── useToast.ts             # Toast notifications
├── lib/
│   ├── calculations/
│   │   ├── dosification.ts     # Dosis, consumo diario, autonomía
│   │   ├── financial.ts        # OPEX, costo/m³, payback
│   │   └── hydraulic.ts        # Caudales, volúmenes, presiones
│   ├── constants.ts            # Productos, inventario mock
│   ├── calidad-agua/           # norma.ts (INEN 1108/TULSMA), spc.ts (Shewhart/Cp/Cpk), indices.ts (LSI, NO3/NO2)
│   ├── gemini-prompts.ts       # Prompts del sistema para IA
│   ├── turbidity.ts            # Predicción turbidez por lluvia
│   ├── pcm-to-wav.ts           # Conversión audio para TTS
│   └── export/                 # excel.ts, memoriaFinanciera.ts, certificadoCalidadAgua.ts
├── types/                      # TypeScript: auth, chemical, finance, inventory, etc.
├── proxy.ts                    # Auth + suscripción guard (Next.js 16 — reemplaza middleware.ts)
└── ConvexClientProvider.tsx    # Provider de Convex + Auth

convex/
├── schema.ts                   # Definición de tablas (ver abajo)
├── auth.config.ts              # Valida JWT de Clerk (CLERK_JWT_ISSUER_DOMAIN)
├── lib/auth.ts                 # getAuthenticatedUser/requireAuthUser (clerkId → users)
├── superAdmin.ts               # Panel Owner global (gate SUPER_ADMIN_EMAIL)
├── waterQualityTests.ts        # CRUD ensayos de calidad del agua (Consola INEN 1108)
├── waterQualityCapa.ts         # CRUD acciones CAPA (causa raíz / acción correctiva)
├── jarTestSessions.ts          # CRUD jar-test sessions
├── shiftRecords.ts             # CRUD registros de turno
├── financialProjections.ts     # CRUD proyecciones financieras
├── inventoryItems.ts           # CRUD inventario
├── bitacoraEntries.ts          # CRUD bitácora
├── plantSettings.ts            # Configuración de planta
├── organizations.ts            # Organizaciones multi-tenant
├── subscriptions.ts            # Suscripciones
├── operatorPermissions.ts      # Permisos por módulo
└── users.ts                    # Usuarios + upsertCurrentUser
```

---

## Variables de Entorno (.env.local)

> **Auth = Clerk (NO `@convex-dev/auth`).** La identidad la maneja Clerk; Convex valida el JWT
> de Clerk (`identity.subject` = `clerkId`). Convex se conecta vía `ConvexProviderWithClerk`.

```bash
# Clerk (identidad)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...            # Backend API: borrar usuarios, sign-in tokens
CLERK_JWT_ISSUER_DOMAIN=https://<tu-app>.clerk.accounts.dev

# Convex conexión
NEXT_PUBLIC_CONVEX_URL=https://clear-albatross-368.convex.cloud
CONVEX_DEPLOY_KEY=dev:clear-albatross-368|...

# Panel Owner (super-admin global) — un solo correo entra a /owner
SUPER_ADMIN_EMAIL=dueno@tudominio.com

# IA (usado también para estimaciones climáticas en /api/weather)
GEMINI_API_KEY=AIzaSy...               # aistudio.google.com
```

**IMPORTANTE — Variables requeridas en Convex Dashboard → Environment Variables:**

| Variable | Para qué | Notas |
|---|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | Validar el JWT de Clerk en Convex | Definida en `convex/auth.config.ts` |
| `SUPER_ADMIN_EMAIL` | Gate del panel `/owner` (super-admin global) | El gate corre en el backend de Convex → DEBE estar aquí, no basta `.env.local`. Configurar con `npx convex env set SUPER_ADMIN_EMAIL <correo>` |

⚠️  El gate de `/owner` (`convex/superAdmin.ts`) lee `process.env.SUPER_ADMIN_EMAIL` en el
backend de Convex. Si solo está en `.env.local` (Next) y NO en el deployment de Convex,
`amISuperAdmin` siempre devuelve `false` y nadie entra al panel.

---

## Tablas Convex (Schema)

### waterQualityTests
Ensayos de la Consola de Vigilancia de Calidad del Agua (`/asistencia`). `results` guarda un
valor crudo (string) por clave de parámetro — ver `src/lib/calidad-agua/norma.ts` (7 grupos,
~26 parámetros INEN 1108:2020, con overrides TULSMA Anexo 1 Tabla 1 para punto `CRUDA`).
`waterQualityTests.getForVerify` (usado por la verificación de certificado por QR) es la
única query del módulo que deliberadamente NO filtra por `organizationId` — ver comentario
en `convex/waterQualityTests.ts`.
```
code: string, point: "SALIDA" | "CRUDA" | "RED"
planta?, operador?, sector?, provincia?, canton?, caudal?
fecha, hora?, analista?, responsable?, metodo?, calibracion?, certificado?, producto?
diagnostico?, results: Record<string, string>, pct: number, fail: number
organizationId?
```

### waterQualityCapaActions
Acciones CAPA (causa raíz / acción correctiva) por no conformidad, una fila por
`(testId, paramKey)`.
```
testId: Id<"waterQualityTests">, paramKey: string
categoria6M?, porques?, accion?, responsable?
estado: "Abierta" | "En proceso" | "Cerrada" | "Verificada"
organizationId?
```

### jarTestSessions
**IMPORTANTE — campos exactos que acepta la mutation:**
```
organizationName: string   ← NO "institution"
samplePoint: string        ← OBLIGATORIO (viene de repoSample en la UI)
date: string
plantFlow: number
opHours: number            ← NO "operationHours"
rawWaterParams: [{label: string, value: number}]  ← Array, NO objeto
chemicals: [{name, func, concentration, pricePerKg}]
observations?: string
aiDiagnosis?: string
organizationId?: (se agrega automáticamente en el handler)
```
Campos que NO están en el schema (no enviar): `jars`, `bestJarId`, `validatedDoses`, `financialSummary`

### shiftRecords
```
operatorName, date, operationHours, plantFlowRef?
hourlyReadings: [{hora, caudal?, ph?, cloro?, color?, turbiedad?,
                  rawPh?, rawCloro?, rawColor?, rawTurbiedad?, status?}]
dosificationEntries: [{product, mlMin, concentration, doseResult, autonomyDays?}]
stats: {avgFlow, volumeTurno, projection24h, compliancePercent}
notes?, aiConsultation?, organizationId?
```

### financialProjections
```
institutionName, mode: "projection" | "analysis"
production: {plantFlow?, opHours?, realM3?, volumeMonth}
humanResources: [{role, quantity, salary, subtotal}]
operationalExpenses: {energy, internet, pettyCash, maintenance}
chemicals: [{name, dose?, totalKg?, pricePerKg, monthlyCost}]
sustainability: {lossPercent, billableVolume, userRate, breakEvenRate, revenue, profit}
totals: {totalChemicals, totalLabor, totalOther, grandTotal, costPerM3}
organizationId?
```

### inventoryItems
```
itemId, itemName, amount, unit, minimumLevel, dailyConsumption
isCorrelated, lastUpdated?, organizationId?
```

### bitacoraEntries
```
date: string, source: string, category: string, summary: string, organizationId?
```

### subscriptions
```
organizationId, status: "trialing"|"active"|"past_due"|"canceled"
plan: "starter"|"pro", trialEndsAt?, expiresAt?, createdAt
```

### operatorPermissions
```
operatorId, organizationId
# Módulos principales
canAccessOperaciones, canAccessAsistencia, canAccessAcademia, canAccessBitacora
# Sub-módulos de /operaciones (opcionales; bloqueados si canAccessOperaciones=false)
canAccessConsolaTecnica?, canAccessHojaOperativa?, canAccessStock?, canAccessFinanzas?
```
⚠️ `canAccessAsistencia` gatea la ruta `/asistencia`, que hoy es la **Consola de Vigilancia
de Calidad del Agua** (no el antiguo módulo de visitas técnicas — eliminado). Se conservó el
nombre de la key para no migrar datos de `operatorPermissions`/`organizations`/`plans`; las
etiquetas visibles en Owner/Admin ya dicen "Calidad de Agua".

---

## Flujo de Autenticación y Suscripción

1. Login vía **Clerk** (`useSignIn`/`useSignUp` de `@clerk/nextjs` en `LoginContent.tsx`).
   `UserSync.tsx` hace `upsertCurrentUser` para crear/sincronizar el doc `users` en Convex.
2. `useSubscription.ts` carga estado desde Convex → escribe cookie `__convexSubStatus`
3. `src/proxy.ts` usa `clerkMiddleware`/`auth.protect()` en cada request (Next.js 16 reemplazó middleware.ts):
   - Sin sesión Clerk → redirige a `/login`
   - `subStatus = "past_due" | "canceled"` → redirige a `/pricing`
   - `subStatus = undefined | "none"` → permite (primera carga, sin bloqueo aún)
   - `subStatus = "active" | "trialing"` → permite acceso
   - `/owner` y `/api/owner` → requieren login pero saltan el gate de suscripción

### Recuperación de contraseña (`/login`)
Flujo nativo de Clerk `reset_password_email_code`, dentro del mismo `LoginContent.tsx`
(sub-vistas `resetRequest` → `resetCode`, sin rutas ni tablas nuevas):
1. `signIn.create({ strategy: "reset_password_email_code", identifier })` → Clerk envía código de 6 dígitos.
2. `signIn.attemptFirstFactor({ strategy, code, password })` → `status: "complete"` crea sesión.
3. Se reutiliza `completeSession()`; la navegación sigue saliendo del **único** `useEffect`
   (no agregar `router.replace` aquí — ver el bug de race condition en Vercel más abajo).

⚠️ E2E: los *test emails* de Clerk (`algo+clerk_test@example.com`) solo funcionan en instancias
de desarrollo (`pk_test`/`sk_test`) y su código de verificación es siempre `424242`.

**Rutas públicas:** `/`, `/login`, `/pricing`, `/motor-inteligencia`

**Prefijos bypass:** `/_next`, `/favicon`, `/api/gemini`, `/api/weather`, `/api/gemini-tts`

### Roles y gates de acceso
- `admin` (org): bypass total en `AuthGuard` — siempre ve todos los módulos de su org.
  Gestiona operadores/permisos en `/dashboard/admin` (scoped a su organización).
- `operator`: acceso por módulo según `operatorPermissions` (8 flags).
- **Super-admin / Owner** (`/owner`): un solo correo definido en `SUPER_ADMIN_EMAIL`.
  Alcance GLOBAL (todas las orgs). No es un rol en la tabla `users`; se identifica por correo.

---

## Panel Owner (Super-Admin global) — `/owner`

Panel privado para el dueño del sistema. **Enlace secreto** (sin entrada en navbar). Requiere login.

- **Gate:** `SUPER_ADMIN_EMAIL` (env de Convex). `convex/superAdmin.ts` → `requireSuperAdmin`
  compara el correo autenticado con la env var. Sin la env var, nadie entra.
- **Backend:** `convex/superAdmin.ts`
  - `amISuperAdmin` (query, no lanza) — gate de la UI.
  - `listAllUsers` (query) — TODAS las cuentas de TODAS las orgs (enriquecido: org, suscripción, permisos).
  - `setPermissionsGlobal` (mutation) — fija permisos de cualquier operador (sin filtro de org).
  - `deleteUserGlobal` (mutation) — borra cualquier cuenta. Reglas: no borrar al propio owner ni
    al `adminUserId` dueño de una org. Devuelve `{ clerkId, email }`.
- **API:** `src/app/api/owner/delete-user/route.ts` (DELETE) — llama `deleteUserGlobal` y además
  borra la cuenta en Clerk (`clerkClient().users.deleteUser`). Necesita `CLERK_SECRET_KEY`.
- **UI:** `src/app/owner/page.tsx` — lista cuentas agrupadas por org, toggles de permisos por
  operador, botón eliminar con confirmación. Los **toggles solo aplican a operadores** (los admin
  tienen acceso total por diseño de `AuthGuard`; se muestran como "Acceso total").
- **Acciones incluidas:** ver cuentas + controlar permisos + eliminar. **NO** cambia contraseñas
  ni crea cuentas (decisión de producto).

---

## Planes de Suscripción

| Feature | Starter ($49/mo) | Pro ($89/mo) |
|---------|-----------------|--------------|
| Operadores | 1 Admin + 3 Op | 1 Admin + 5 Op |
| Operaciones básicas | ✓ | ✓ |
| Finanzas completo | básico | ✓ |
| Asistencia técnica | — | ✓ |
| Bitácora maestra | — | ✓ |
| Academia | Módulos I-II | Módulos I-IV |
| IA avanzada | básico | ✓ |

---

## Patrones de Código

### Convex queries y mutations
```typescript
// Query — retorna undefined si Convex no está configurado
const items = useSafeQuery(api.inventoryItems.getAll);

// Mutation — no-op si Convex no está configurado
const createItem = useSafeMutation(api.inventoryItems.create);
```

### Manejo de errores en mutations (patrón correcto)
```typescript
try {
  await createItem({ ... });
  showToast("Guardado", "success");
} catch {
  showToast("Error al guardar", "error");
}
```

---

## Modelos de IA Configurados

| Endpoint | Modelo | Uso |
|---|---|---|
| `/api/gemini` | `gemini-2.5-flash` | Análisis, diagnósticos, recomendaciones |
| `/api/gemini-tts` | `gemini-2.5-flash-preview-tts` | Texto a voz |

**Nota:** `gemini-2.5-flash-preview-05-20` fue deprecado. El modelo anterior `gemini-2.0-flash` agota cuota en tier gratuito. Usar siempre `gemini-2.5-flash`.

---

## Notas de Next.js 16

- **`src/middleware.ts` NO debe existir** — Next.js 16 deprecó esta convención y lanza error si ambos archivos coexisten:
  ```
  Error: Both middleware file "./src/middleware.ts" and proxy file "./src/proxy.ts" are detected.
  Please use "./src/proxy.ts" only.
  ```
- El guard de autenticación y suscripción vive en **`src/proxy.ts`** y es levantado automáticamente por Next.js 16. La función debe exportarse con el nombre `proxy` (coincide con el nombre del archivo):
  ```typescript
  export function proxy(request: NextRequest) { ... }  // ← nombre obligatorio
  export const config = { matcher: [...] }
  ```
- Si alguien restaura `middleware.ts` por error, el servidor entra en estado de error y deja de aplicar el guard. **Borrar siempre `src/middleware.ts` si aparece.**
- Turbopack es el bundler por defecto en Next.js 16
- Para correr el preview server con Claude: usar `/opt/homebrew/bin/node` en launch.json con `env PATH=...` ya que Turbopack necesita `node` en PATH del sistema para PostCSS

---

## Bugs Corregidos en Esta Sesión

### CRÍTICO — `src/app/operaciones/consola-tecnica/page.tsx`
La llamada a `createJarTest` enviaba campos incompatibles con el schema de Convex:
- `institution` → corregido a `organizationName`
- `operationHours` → corregido a `opHours`
- `samplePoint` faltaba → agregado desde `repoSample || "N/A"`
- `rawWaterParams` era objeto → corregido a array `[{label, value}]`
- Eliminados campos no existentes en schema: `jars`, `bestJarId`, `validatedDoses`, `financialSummary`

### UX — `src/app/operaciones/stock/page.tsx`
`catch { /* silent */ }` en `updateAmountMut` → ahora muestra toast de error al usuario.

### ENV — Nombre de variables en `.env.local`
- `GEMINI_GOOGLE` → corregido a `GEMINI_API_KEY`
- `SITE_URL` → corregido a `CONVEX_SITE_URL`
- Agregado `NEXT_PUBLIC_CONVEX_URL` que faltaba
- Agregado `CONVEX_DEPLOY_KEY`

### CRÍTICO (PRODUCCIÓN) — `src/app/login/LoginContent.tsx` — Login trabado en Vercel
**Síntoma:** en `https://terah2o.vercel.app` el login se quedaba trabado con spinner eterno
tras ingresar credenciales correctas.

**Causa raíz:** doble `router.replace` generaba race condition en App Router.

Flujo con bug:
1. `signIn` resuelve → `router.replace(nextPath)` inmediato (navegación A)
2. React re-renderiza → `isAuthenticated=true` → `useEffect` → `setRedirecting(true)` → `router.replace(nextPath)` (navegación B)
3. En localhost (red local ~0ms): A termina antes de que B dispare → OK
4. En Vercel (latencia real ~200-500ms): A y B vuelan en paralelo → App Router cancela ambas → componente queda montado con `redirecting=true` → **spinner eterno**

**Fix aplicado:** eliminar el `router.replace` de `handleSubmit`. En su lugar se llama
`setRedirecting(true)` para mostrar el spinner inmediatamente. El `useEffect` es el único
responsable de hacer la navegación cuando `isAuthenticated` flipea (siguiente render cycle).

---

## Migraciones Importantes

### Asistencia → Consola de Vigilancia de Calidad del Agua (`/asistencia`)
El módulo de Asistencia Técnica (visitas multi-cliente, cotizaciones comerciales) fue
**eliminado por completo** y reemplazado por la Consola de Vigilancia de Calidad del Agua
(NTE INEN 1108:2020 / TULSMA Anexo 1 Tabla 1), reescrita nativamente sobre Convex + Clerk a
partir de un HTML standalone (Firebase) usado como referencia de producto.

- **Ruta y permiso sin cambios:** sigue siendo `/asistencia` con el flag
  `canAccessAsistencia` (mismo nombre técnico; las etiquetas visibles en Owner/Admin/landing
  ahora dicen "Calidad de Agua" — ver `### operatorPermissions` arriba).
- **Tabla `visitas` eliminada** (purgada y borrada de `convex/schema.ts`) — reemplazada por
  `waterQualityTests` y `waterQualityCapaActions` (ver sección "Tablas Convex").
- **Sin backup de datos históricos de `visitas`** — se eliminaron directamente por decisión
  explícita al planear la migración.
- **Verificación por QR requiere login** (a diferencia del HTML original, que permitía
  verificar sin cuenta vía Firebase Auth anónimo) — consistente con el resto de la
  plataforma, que no tiene rutas públicas para módulos operativos.
- Lógica de norma/SPC/índices portada a `src/lib/calidad-agua/` (`norma.ts`, `spc.ts`,
  `indices.ts`) — módulos puros, sin React, para poder verificarlos de forma aislada.
- Certificado imprimible en `src/lib/export/certificadoCalidadAgua.ts`, mismo patrón que
  `memoriaFinanciera.ts` (Blob + `window.open`, no `window.print()` sobre un div oculto).

---

## Comandos de Desarrollo

```bash
# Desarrollo local (correr los dos en paralelo)
npx convex dev     # Terminal 1 — sincroniza schema y backend
npm run dev        # Terminal 2 — Next.js en localhost:3000

# Producción
npx convex deploy  # Deploy backend
npm run build      # Build Next.js
npm run lint       # Verificar linting
```

## Primer Setup (usuario nuevo)

1. Correr `npx convex dev` → genera `convex/_generated/`
2. Ir a Convex Dashboard → **Environment Variables** → agregar `CONVEX_SITE_URL`, `SITE_URL`, `JWKS`, `JWT_PRIVATE_KEY` (ver tabla arriba)
3. Ir a `http://localhost:3000/login` → crear cuenta con Sign Up
4. En Convex Dashboard → tabla `users` → cambiar `role` a `"admin"` para tu usuario
5. En tabla `organizations` → crear registro con tu `userId` como `adminUserId`
6. En tabla `subscriptions` → crear registro con `status: "trialing"` y tu `organizationId`

---

## Credenciales de Prueba E2E (Playwright)

```bash
# Operador de prueba — usuario carlos creado en Convex/auth
TEST_EMAIL=carlos.test.777@ptap.ec
TEST_PASSWORD=segura123@
```

Estas credenciales se usan en `tests/auth.spec.ts` y `tests/bitacora.spec.ts`.
El helper `loginWithClerkTicket` usa `CLERK_SECRET_KEY` (en `.env.local`) para emitir tokens sin CAPTCHA.
