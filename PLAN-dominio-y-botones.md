# Plan — solicitudes de José Alfredo (13–14 ago 2026)

Fuente: chat de WhatsApp 13-ago → 17-ago. Tres pedidos distintos, con dependencias
distintas. Uno ya está hecho.

| # | Pedido | Estado | Bloqueado por |
|---|---|---|---|
| 1 | Recuperación de contraseña | ✅ **Hecho y verificado** — 7/7 tests en verde | — |
| 2 | Reestructura de dominio (`www` + `app`) | ⏸ Código listo, falta ejecutar | DNS del registrador + dashboard de Clerk |
| 3 | Botones de herramientas en la portada | ✅ **Cableado y verificado** en local | Falta desplegar (depende del #2) |

## Estado al 17-ago-2026, 21:00

Lo hecho en esta sesión:

- **Fase 0 completa.** `login-forgot-password.spec.ts` → 7/7 en verde contra
  `localhost:3010` (el `:3000` de la máquina es de otro proyecto, `dev/reportes`).
- **Specs nuevos creados:** `tests/dominios.spec.ts` (7) y `tests/portada.spec.ts` (9).
  Los 16 parsean, se saltan sin `DOMAIN_TESTS=1`, `npm run lint` sin errores.
- **Verificado en vivo:** las tres herramientas responden `200`; `/motor-inteligencia`
  responde `307 → /login` (el conflicto de la Fase 2 es real, no teórico).
- **Portada cableada.** Su `index.html` (recuperado del export con adjuntos) ya
  traía las 5 tarjetas construidas con `href="#"`. Se cablearon 4; la de
  dimensionamiento se dejó sin cablear, como pidió. 19/19 aserciones en verde en
  navegador real. Queda en `~/Desktop/dev/terah2o-portada/` junto al brochure
  renombrado a `TERAH2O-Brochure.pdf` (el nombre que su HTML ya esperaba).

---

## Fase 0 — Recuperación de contraseña (verificar, no reimplementar)

Ya está en `master`: commit `38e20f9`, PR #20. Flujo nativo de Clerk
`reset_password_email_code` dentro de `src/app/login/LoginContent.tsx`
(sub-vistas `resetRequest` → `resetCode`, sin rutas ni tablas nuevas).

### Pruebas — ya existen

`tests/login-forgot-password.spec.ts`, 7 tests:

| Test | Qué prueba |
|---|---|
| enlace visible en Ingresar / oculto en Registrarse | el link no se filtra al signup |
| el enlace abre el formulario | transición de vista y ocultamiento del login |
| el correo se arrastra | UX: no reescribir el email |
| "Volver a ingresar" regresa | la vista es reversible |
| correo sin cuenta → error | no avanza al paso del código |
| código correcto fija clave nueva | **E2E real contra Clerk**, incluye código incorrecto primero |
| clave nueva vigente / vieja inválida | verificación server-side vía Backend API |

### Cómo correrlas

Requiere los dos servidores arriba, en terminales separadas:

```bash
npx convex dev
```

```bash
npm run dev
```

Y luego:

```bash
npm run test:e2e -- login-forgot-password.spec.ts
```

### Criterio de aceptación

7/7 en verde.

### Riesgo a cubrir aparte

El E2E usa un *test email* de Clerk (`...+clerk_test@example.com`, código fijo
`424242`). **Eso solo funciona en instancias de desarrollo** (`pk_test`/`sk_test`).
En producción (`pk_live`) ese atajo no existe, así que la verificación en prod es
manual, una sola vez:

1. Crear una cuenta desechable real en `app.terah2o.com/login`.
2. Pedir recuperación → confirmar que llega el correo con el código.
3. Cambiar la contraseña → confirmar que entra con la nueva y no con la vieja.

Hacerlo **después** de la Fase 1 (el dominio cambia de dónde sale el correo).

---

## Fase 1 — Reestructura de dominio

### Objetivo

- `www.terah2o.com` → la portada de José Alfredo (su `index.html`)
- `terah2o.com` (apex) → redirige a `www`
- `app.terah2o.com` → este Next.js (hoy en `terah2o.vercel.app`)

### Decisión de arquitectura: dos proyectos Vercel separados

La portada es un `index.html` estático. Meterla dentro del Next.js obligaría a
convivir con `src/proxy.ts` (Clerk corre en **cada** request por el matcher
`/((?!_next/static|_next/image|favicon.ico).*)`) sin ninguna ganancia. Separada:

- despliegues independientes — él puede tocar su portada sin redesplegar el SaaS
- cero riesgo de que el guard de auth toque una página pública
- el rollback de uno no arrastra al otro

### Pasos

**1.1 — Proyecto de la portada**

Repo nuevo (p. ej. `TERAH2O/portada`) con el `index.html` + el brochure PDF como
asset. Import en Vercel, framework `Other`, sin build command.

**1.2 — Dominios en Vercel**

| Proyecto | Dominio | Config |
|---|---|---|
| `portada` | `www.terah2o.com` | primario |
| `portada` | `terah2o.com` | redirect 308 → `www.terah2o.com` |
| `terah2o` (este repo) | `app.terah2o.com` | primario |
| `terah2o` | `terah2o.vercel.app` | se mantiene (no romper enlaces viejos) |

**1.3 — DNS en el registrador**

Los valores exactos los dicta Vercel al agregar cada dominio — usar esos, no
copiarlos de memoria. La forma es:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | el que indique Vercel para el apex |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `app` | `cname.vercel-dns.com` |

Propagación: hasta 48 h, normalmente minutos. No dar por cerrada la fase hasta
que los tres resuelvan.

**1.4 — Clerk (el punto que más se rompe)**

La instancia de producción de Clerk está atada a un dominio. Cambiar de
`terah2o.vercel.app` a `app.terah2o.com` exige, en el dashboard de Clerk:

- Domains → agregar/cambiar el dominio de producción a `app.terah2o.com`
- copiar los registros DNS de Clerk (`clerk.`, `accounts.`, y los CNAME de correo
  `clkmail` / DKIM) al registrador
- actualizar `CLERK_JWT_ISSUER_DOMAIN` en **Vercel** y en **Convex**
  (`npx convex env set CLERK_JWT_ISSUER_DOMAIN <nuevo>`)

Si el issuer no coincide, Convex rechaza todos los JWT y **la app entera queda sin
datos** aunque el login parezca funcionar. Es el fallo más caro de esta fase.

**1.5 — Convex**

No tiene binding de dominio. No requiere cambios, salvo el `CLERK_JWT_ISSUER_DOMAIN`
del paso anterior.

### Pruebas — `tests/dominios.spec.ts` (nuevo)

Corre contra los dominios reales, así que es opt-in: no debe romper la suite local.

```ts
import { test, expect, request } from "@playwright/test";

/**
 * Verificación de la reestructura de dominio (Fase 1).
 * Opt-in: solo corre con DOMAIN_TESTS=1, porque golpea los dominios reales.
 *
 *   DOMAIN_TESTS=1 npm run test:e2e -- dominios.spec.ts
 */
const APP = "https://app.terah2o.com";
const WWW = "https://www.terah2o.com";
const APEX = "https://terah2o.com";

test.skip(!process.env.DOMAIN_TESTS, "requiere DOMAIN_TESTS=1");

test.describe("Dominios", () => {
  test("app.terah2o.com sirve el Next.js y no la portada", async ({ page }) => {
    await page.goto(APP);
    await expect(page.locator("text=INTELIGENCIA OPERATIVA")).toBeVisible();
  });

  test("www.terah2o.com sirve la portada estática", async ({ page }) => {
    const res = await page.goto(WWW);
    expect(res?.status()).toBe(200);
    // La portada NO debe cargar el bundle de Next.js
    await expect(page.locator("script[src*='/_next/']")).toHaveCount(0);
  });

  test("el apex redirige a www", async () => {
    const ctx = await request.newContext({ maxRedirects: 0 });
    const res = await ctx.get(APEX);
    expect([301, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("www.terah2o.com");
    await ctx.dispose();
  });

  test("los tres dominios sirven HTTPS con certificado válido", async () => {
    // request.newContext falla ante un certificado inválido salvo ignoreHTTPSErrors
    const ctx = await request.newContext({ ignoreHTTPSErrors: false });
    for (const url of [APP, WWW, APEX]) {
      const res = await ctx.get(url);
      expect(res.status(), `${url} debe responder`).toBeLessThan(400);
    }
    await ctx.dispose();
  });

  test("terah2o.vercel.app sigue vivo (no romper enlaces viejos)", async () => {
    const ctx = await request.newContext();
    const res = await ctx.get("https://terah2o.vercel.app");
    expect(res.status()).toBeLessThan(400);
    await ctx.dispose();
  });
});

test.describe("Auth sobre el dominio nuevo (regresión de Clerk)", () => {
  test("una ruta protegida sin sesión redirige a /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`${APP}/operaciones`);
    await page.waitForURL(/\/login/, { timeout: 20000 });
    expect(page.url()).toContain("/login");
  });

  test("/login carga el formulario de Clerk en el dominio nuevo", async ({ page }) => {
    await page.goto(`${APP}/login`);
    await expect(page.getByTestId("password-input")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("forgot-password-link")).toBeVisible();
  });
});
```

**Además, la suite completa contra el dominio nuevo** — es la prueba de que
Clerk + Convex siguen hablando:

```bash
PLAYWRIGHT_BASE_URL=https://app.terah2o.com npm run test:e2e
```

### Criterio de aceptación

- `dominios.spec.ts` en verde con `DOMAIN_TESTS=1`
- la suite completa en verde contra `PLAYWRIGHT_BASE_URL=https://app.terah2o.com`
- login manual en `app.terah2o.com` que **carga datos de Convex** (entrar a
  `/operaciones/stock` y ver el inventario) — esto es lo que detecta un
  `CLERK_JWT_ISSUER_DOMAIN` mal puesto

---

## Fase 2 — Botones de herramientas en la portada

### Los destinos

Los tres repos son apps HTML de un solo archivo, públicas, **ya desplegadas**. No
hay que portarlas ni integrarlas — solo enlazarlas.

| Botón | Destino | Origen |
|---|---|---|
| Simulador de PTAP | `https://simulador-neon.vercel.app` | `TERAH2O/Simulador` |
| Filtros de arena | `https://filtros-de-arena.vercel.app` | `TERAH2O/FILTROS-DE-ARENA` |
| Calculadora de gradiente | `https://calculadora-gradiente.vercel.app` | `TERAH2O/CALCULADORA-GRADIENTE` |
| Motor hidrometeorológico | `https://app.terah2o.com/motor-inteligencia` | este repo |
| Brochure institucional | `/brochure.pdf` | asset en el proyecto portada |
| Dimensionamiento | — | **él dijo que aún no está listo** |

### Detalles de implementación

- Los tres externos: `target="_blank"` + `rel="noopener noreferrer"`.
- El del motor: **mismo tab**, es "el sistema", no una herramienta suelta.
- Dimensionamiento: no renderizar el botón todavía. Un botón muerto o un `#` es
  peor que su ausencia. Dejar el marcado comentado con un `TODO` para cuando lo mande.
- Brochure: `download` en el `<a>` para que baje en vez de abrir el visor.

### ⚠️ Conflicto a resolver con él antes de codificar

`/motor-inteligencia` **ya no es una ruta pública**. `src/proxy.ts:8` lo dice
explícito: requiere login **y** suscripción activa, y sin plan redirige a
`/pricing`. (El `CLAUDE.md` todavía dice que es pública — está desactualizado.)

Entonces, un visitante anónimo que pulse ese botón en la portada pública termina
en `/login`. Dos caminos:

- **(a) Dejarlo así** — el botón es la puerta de entrada al SaaS y el login es
  esperado. Cero cambios de código.
- **(b) Volverlo público** — agregar `"/motor-inteligencia"` a `isPublicRoute` en
  `src/proxy.ts`. Convierte el motor en carnada comercial, pero regala una función
  que hoy es de pago.

Es decisión de producto, no técnica. **Preguntarle a él.** El plan asume (a) hasta
que responda; cambiar a (b) es una línea y un test.

### Pruebas — `tests/portada.spec.ts` (nuevo)

```ts
import { test, expect, request } from "@playwright/test";

/**
 * Botones de herramientas en la portada (Fase 2).
 * Opt-in igual que dominios.spec.ts.
 *
 *   DOMAIN_TESTS=1 npm run test:e2e -- portada.spec.ts
 */
const WWW = "https://www.terah2o.com";

const HERRAMIENTAS = [
  { nombre: /simulador/i, href: "https://simulador-neon.vercel.app" },
  { nombre: /filtros/i, href: "https://filtros-de-arena.vercel.app" },
  { nombre: /gradiente/i, href: "https://calculadora-gradiente.vercel.app" },
];

test.skip(!process.env.DOMAIN_TESTS, "requiere DOMAIN_TESTS=1");

test.describe("Portada — botones de herramientas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WWW);
  });

  for (const { nombre, href } of HERRAMIENTAS) {
    test(`el botón ${href} existe, apunta bien y abre en pestaña nueva`, async ({ page }) => {
      const link = page.locator(`a[href^="${href}"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("target", "_blank");
      // rel debe traer noopener: sin él, la página destino puede manipular window.opener
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toContainText(nombre);
    });
  }

  test("el botón del motor apunta al subdominio de la app, en el mismo tab", async ({ page }) => {
    const link = page.locator('a[href*="app.terah2o.com/motor-inteligencia"]');
    await expect(link).toHaveCount(1);
    await expect(link).not.toHaveAttribute("target", "_blank");
  });

  test("el brochure se descarga y es un PDF real", async ({ page }) => {
    const link = page.locator('a[href$=".pdf"]');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("download", /.*/);

    const ctx = await request.newContext();
    const href = await link.getAttribute("href");
    const res = await ctx.get(new URL(href!, WWW).toString());
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    await ctx.dispose();
  });

  test("dimensionamiento todavía NO aparece (él dijo que no está listo)", async ({ page }) => {
    await expect(page.locator("text=/dimensionamiento/i")).toHaveCount(0);
  });

  test("ningún enlace de la portada apunta a '#' o a vacío", async ({ page }) => {
    const rotos = page.locator('a[href="#"], a[href=""], a:not([href])');
    await expect(rotos).toHaveCount(0);
  });
});

test.describe("Portada — los destinos responden", () => {
  test("las tres herramientas devuelven 200 y no una página de error de Vercel", async () => {
    const ctx = await request.newContext();
    for (const { href } of HERRAMIENTAS) {
      const res = await ctx.get(href);
      expect(res.status(), `${href} debe responder 200`).toBe(200);
      const html = await res.text();
      expect(html, `${href} no debe ser un 404 de Vercel`).not.toContain("DEPLOYMENT_NOT_FOUND");
    }
    await ctx.dispose();
  });

  test("el motor exige login para un anónimo (comportamiento actual, opción (a))", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("https://app.terah2o.com/motor-inteligencia");
    await page.waitForURL(/\/login|\/pricing/, { timeout: 20000 });
  });
});
```

> Si él elige la opción **(b)** (motor público), el último test se invierte: en vez
> de esperar el redirect, esperar que la página del motor cargue. Y hay que agregar
> `"/motor-inteligencia"` a `isPublicRoute` en `src/proxy.ts`.

### Criterio de aceptación

- `portada.spec.ts` en verde
- los 5 botones abiertos a mano, uno por uno, en móvil y en escritorio

---

## Orden de ejecución

```
Fase 0  ──────────────────────────────►  independiente, se puede hacer hoy
                                          (correr los 7 tests, avisarle)

Fase 1  ──────────────────────────────►  necesita: index.html + acceso al DNS
   │                                      necesita: acceso al dashboard de Clerk
   └──► Fase 2  ────────────────────────► necesita: Fase 1 lista
                                          (el botón del motor apunta a app.terah2o.com)

Fase 3 (cierre) ──────────────────────►  suite completa contra el dominio nuevo
                                          + verificación manual del reset en prod
```

## Lo que hace falta de él

1. ~~El `index.html` de la portada~~ — ✅ recuperado del export con adjuntos.
2. ~~El brochure PDF~~ — ✅ recuperado y renombrado a `TERAH2O-Brochure.pdf`.
3. **Acceso al DNS** de `terah2o.com` — dónde está registrado y quién lo administra.
4. **Acceso al dashboard de Clerk** con permisos para cambiar el dominio de producción.
5. **Respuesta al conflicto del motor** — opción (a) o (b) de la Fase 2.
6. Confirmar si el `.mov` y los 4 audios del 13-ago traen detalles no dichos por texto.

### Dato útil que salió de su `index.html`

Su portada **ya está construida asumiendo la estructura de dominio que pide**:
contiene `href="https://app.terah2o.com"` y `href="https://app.terah2o.com/academia"`
hardcodeados. Es decir, esos enlaces están rotos hasta que exista el subdominio —
razón de más para que la Fase 1 vaya antes del despliegue de la portada.

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` desincronizado entre Vercel y Convex | App carga pero sin datos; parece un bug de Convex | Prueba manual de `/operaciones/stock` tras el cambio; es el criterio de aceptación de la Fase 1 |
| DNS propagando durante la migración | Ventana de intermitencia | Mantener `terah2o.vercel.app` activo; migrar fuera de horario de uso |
| Las 3 herramientas viven en cuentas Vercel de él | Un borrado suyo rompe la portada sin aviso | Los tests de "destinos responden" lo detectan; correrlos periódicamente |
| Portada estática sin control de versiones | Cambios suyos sin trazabilidad | Meter el `index.html` en `TERAH2O/portada` y desplegar desde ahí, no por drag-and-drop |
