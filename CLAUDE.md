# TeraH2O — Contexto del Proyecto para Claude

## Descripción General

TeraH2O es una plataforma SaaS de inteligencia operacional para plantas de tratamiento de agua potable (PTAP). Permite a operadores de agua gestionar dosificación química, inventario, finanzas, asistencia técnica multi-cliente y formación. Lista para entrega comercial.

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
│   ├── asistencia/             # Visitas multi-cliente, cotizaciones
│   ├── academia/               # Módulos educativos (4 módulos)
│   ├── dashboard/
│   │   ├── profile/            # Perfil usuario y suscripción
│   │   └── admin/              # Gestión operadores y permisos
│   └── api/
│       ├── gemini/route.ts     # Google Gemini 2.5 Flash (IA) — modelo: gemini-2.5-flash
│       ├── gemini-tts/route.ts # TTS — modelo: gemini-2.5-flash-preview-tts
│       ├── weather/route.ts    # OpenWeatherMap API
│       ├── check-subscription/ # Verificar suscripción
│       └── admin/              # Crear operadores, permisos
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
│   ├── constants.ts            # Límites INEN 1108, productos, inventario mock
│   ├── gemini-prompts.ts       # Prompts del sistema para IA
│   ├── turbidity.ts            # Predicción turbidez por lluvia
│   ├── pcm-to-wav.ts           # Conversión audio para TTS
│   └── export/excel.ts         # Exportación a Excel (.xlsx)
├── types/                      # TypeScript: auth, chemical, finance, inventory, etc.
├── proxy.ts                    # Auth + suscripción guard (Next.js 16 — reemplaza middleware.ts)
└── ConvexClientProvider.tsx    # Provider de Convex + Auth

convex/
├── schema.ts                   # Definición de tablas (ver abajo)
├── auth.ts / auth.config.ts    # Configuración @convex-dev/auth (Password provider)
├── visitas.ts                  # CRUD visitas asistencia técnica
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

```bash
# Convex Auth — generadas con npx convex dev
JWKS={"keys":[...]}
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...

# Convex conexión
NEXT_PUBLIC_CONVEX_URL=https://clear-albatross-368.convex.cloud
CONVEX_DEPLOY_KEY=dev:clear-albatross-368|...

# Convex Auth URL
CONVEX_SITE_URL=http://localhost:3000   # producción: https://tudominio.com

# IA (usado también para estimaciones climáticas en /api/weather)
GEMINI_API_KEY=AIzaSy...               # aistudio.google.com
```

**IMPORTANTE — Variables también requeridas en Convex Dashboard → Environment Variables:**
- `SITE_URL` = `http://localhost:3000`
- `JWKS` = mismo valor que en .env.local
- `JWT_PRIVATE_KEY` = mismo valor que en .env.local

---

## Tablas Convex (Schema)

### visitas
`idInforme` se genera automáticamente en el servidor: `TERA-${Date.now()}` — NO enviar desde cliente.
```
tipoCliente: "CARTERA" | "POTENCIAL"
org, telefono, correo?, autoridad?, tecnicoPlanta?, provincia?, canton?
caudal?, horasOperacion?, compliance?, observaciones?
params: [{name, raw?, treated?, limit, ok}]
dosages: [{product, mgL: string, days: string}]
comercial: {proveedor?, marketProducts[], adquisicion?, contratacion?,
            fechaCompra?, comentarios?, cotizacion:[{prod,qty,price,total}], totalQuote?}
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
canAccessOperaciones, canAccessAsistencia, canAccessAcademia, canAccessBitacora
```

---

## Flujo de Autenticación y Suscripción

1. Login vía `@convex-dev/auth` (Password provider) → JWT en cookie `__convexAuthJWT`
2. `useSubscription.ts` carga estado desde Convex → escribe cookie `__convexSubStatus`
3. `src/proxy.ts` verifica cookies en cada request (Next.js 16 reemplazó middleware.ts):
   - Sin JWT → redirige a `/login`
   - `subStatus = "past_due" | "canceled"` → redirige a `/pricing`
   - `subStatus = undefined | "none"` → permite (primera carga, sin bloqueo aún)
   - `subStatus = "active" | "trialing"` → permite acceso

**Rutas públicas:** `/`, `/login`, `/pricing`, `/motor-inteligencia`

**Prefijos bypass:** `/_next`, `/favicon`, `/api/gemini`, `/api/weather`, `/api/gemini-tts`

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

### UX — `src/app/asistencia/page.tsx`
El `showToast("éxito")` estaba fuera del try → ahora está dentro, y el catch muestra error real.

### UX — `src/app/operaciones/stock/page.tsx`
`catch { /* silent */ }` en `updateAmountMut` → ahora muestra toast de error al usuario.

### ENV — Nombre de variables en `.env.local`
- `GEMINI_GOOGLE` → corregido a `GEMINI_API_KEY`
- `SITE_URL` → corregido a `CONVEX_SITE_URL`
- Agregado `NEXT_PUBLIC_CONVEX_URL` que faltaba
- Agregado `CONVEX_DEPLOY_KEY`

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
2. Ir a Convex Dashboard → **Environment Variables** → agregar `SITE_URL`, `JWKS`, `JWT_PRIVATE_KEY`
3. Ir a `http://localhost:3000/login` → crear cuenta con Sign Up
4. En Convex Dashboard → tabla `users` → cambiar `role` a `"admin"` para tu usuario
5. En tabla `organizations` → crear registro con tu `userId` como `adminUserId`
6. En tabla `subscriptions` → crear registro con `status: "trialing"` y tu `organizationId`
