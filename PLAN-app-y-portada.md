# Plan: portada en `terah2o.com` y sistema instalable en `app.terah2o.com`

Fuente: el mensaje de José Alfredo (WhatsApp, 6:22 PM):

> "El sistema que está alojado en terah2o.com llevarlo al subdominio app.terah2o.com
> para que permita descargar como una app!"

Ese mensaje también incluye el mapa de rutas que quiere para `terah2o.com`:
`/` (portada: presentación de la plataforma y accesos principales), `/filtro-de-agua`,
`/gradiente`, `/simulador`, `/login`, `/pricing`. Dimensionamiento de planta
queda vacío porque él aún trabaja en esa herramienta.

> ⚠️ **Hay que confirmarlo antes de codificar.** En el cuestionario se respondió
> "app.terah2o.com = presentación", pero el mensaje de José Alfredo dice lo
> contrario: el **sistema** va a `app.terah2o.com` y se instala como app, y
> `terah2o.com` queda como la portada con la presentación. Este plan sigue el mensaje
> de José Alfredo. Si la intención es la otra, se cambian los dos hosts en la Fase 1
> y la PWA de la Fase 3 pasa al otro dominio. El resto del plan no cambia.

## Resultado esperado

| Dominio | Qué muestra |
|---|---|
| `terah2o.com` | **Portada**: la presentación institucional (el contenido actual de `/presentacion`) con una sección de **accesos principales** (Sistema, Filtro de arena, Gradiente, Simulador y Dimensionamiento como "Próximamente"). También `/filtro-de-agua`, `/gradiente` y `/simulador`. |
| `www.terah2o.com` | Redirección 308 a `terah2o.com` |
| `app.terah2o.com` | **El sistema**: la página de inicio actual con Operaciones, Calidad de Agua, Motor y Academia, **sin** el botón "Presentación institucional". Se puede **instalar como app** (PWA). |
| `terah2o.vercel.app` | Igual que `app.terah2o.com`, para no romper enlaces viejos ni los previews |

Decisiones tomadas en el cuestionario:
- La portada estática `portada/index.html` **se reemplaza**. Sus botones de
  herramientas pasan a la nueva portada.
- La app se instala **desde el navegador** (PWA). No se publica en Play Store ni en App Store.
- El ícono lo creo yo a partir del logotipo TERA H2O. Se puede cambiar después.

---

## Arquitectura: un solo proyecto Vercel, dos dominios, enrutado por host

Los dos dominios se sirven desde este mismo Next.js. `src/proxy.ts` mira el host
de cada request:

```
terah2o.com /                    → rewrite interno a /presentacion (la URL no cambia)
terah2o.com /filtro-de-agua...   → rewrites existentes (next.config.ts), sin cambios
terah2o.com /operaciones, /login, /pricing, /dashboard, /academia, ...
                                 → 308 a https://app.terah2o.com<misma ruta>
                                   (bookmarks y enlaces viejos siguen funcionando)
terah2o.com /manifest, /sw.js    → 404 (la portada no se instala)
www.terah2o.com/*                → 308 a https://terah2o.com/*

app.terah2o.com /presentacion    → 308 a https://terah2o.com/
app.terah2o.com /*               → como hoy: Clerk + gate de suscripción
```

Por qué así y no con dos proyectos:
- `/presentacion` ya es una página de Next con componentes compartidos
  (`WHATSAPP_LINK`, estilos). Sacarla a HTML estático duplicaría código.
- En la portada (`terah2o.com`) Clerk no interviene: el proxy devuelve la
  respuesta antes de llamar a `auth()`. Así se evita el riesgo que el plan
  anterior quería evitar con dos proyectos.
- Un solo deploy y una sola configuración de variables de entorno.

Cualquier host desconocido (previews `*.vercel.app`, `localhost`) se trata como
**app**. En esos hosts la portada se puede ver en `/presentacion` para probarla.

`/login` y `/pricing` aparecen en la lista de José Alfredo para `terah2o.com`. Se
sirven en `app.terah2o.com` y `terah2o.com` redirige a ellas. El login
tiene que vivir en el mismo origen que la app instalada; si no, la PWA saca al
usuario al navegador para iniciar sesión.

---

## Fase 1: enrutado por host (código)

| Archivo | Cambio |
|---|---|
| `src/lib/hosts.ts` (nuevo) | `PORTADA_HOSTS = ["terah2o.com", "www.terah2o.com"]` y `APP_ORIGIN = "https://app.terah2o.com"`, con overrides opcionales por env (`NEXT_PUBLIC_APP_ORIGIN`) para poder probar en local |
| `src/proxy.ts` | Rama de portada al inicio, antes de `isPublicRoute` y de `auth()`: rewrite de `/` a `/presentacion`, deja pasar las herramientas y `/TERAH2O-Brochure.pdf`, y redirige 308 todo lo demás a `APP_ORIGIN`. En el host app, `/presentacion` redirige 308 a la portada. |
| `src/app/presentacion/page.tsx` | El CTA "acceder al sistema" (`href="/"`, línea ~1058) pasa a `APP_ORIGIN`. Se añade la sección **Accesos principales** con las tarjetas: Sistema, Filtro de arena, Gradiente, Simulador y Dimensionamiento ("Próximamente", sin enlace). Los textos salen del mapa de rutas que mandó José Alfredo. |
| `src/app/page.tsx` | Se **elimina** el botón "Presentación institucional" (líneas 57-75). |
| `src/lib/email/invitation.ts` | El enlace de invitación (hoy `https://terah2o.vercel.app`) pasa a `APP_ORIGIN` |
| `portada/` | Se elimina el directorio (index.html, vercel.json y el PDF duplicado). Si se llegó a crear el proyecto Vercel "portada", se archiva. |
| `PLAN-dominio-y-botones.md` | Se marca como reemplazado por este plan |
| `CLAUDE.md` | Se actualizan la sección de dominios, las rutas públicas y la PWA |

Metadatos de cada host: la portada mantiene el título y la descripción comerciales
de `/presentacion`, y la app usa los actuales de `layout.tsx`. Se añade `<link
rel="canonical">` en la portada para que Google indexe `terah2o.com`, no
`app.terah2o.com/presentacion`.

## Fase 2: ícono

- Diseño: "TERA" en blanco y "H2O" en azul `#3b82f6` sobre fondo `#05051a`, los
  mismos colores del inicio. Variante **maskable** con margen de seguridad del 20 %
  para Android.
- Se generan desde un SVG fuente (`public/icons/icon.svg`):
  `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png` (180×180) y `favicon.ico`.
- El SVG queda en el repositorio. Si después llega un logo oficial, se
  reemplaza ese archivo y se vuelven a generar los PNG.

## Fase 3: PWA instalable en `app.terah2o.com`

| Archivo | Contenido |
|---|---|
| `src/app/manifest.ts` (nuevo) | `name: "TeraH2O — Inteligencia Operativa"`, `short_name: "TeraH2O"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `background_color`/`theme_color: "#05051a"`, `lang: "es-EC"`, íconos de la Fase 2. Los *shortcuts* (Operaciones, Calidad de Agua, Academia) aparecen al mantener pulsado el ícono. |
| `public/sw.js` (nuevo) | Service worker **mínimo y conservador**: los archivos `/_next/static/*` e íconos van primero a caché (tienen hash, así que es seguro). La navegación va primero a la red y, si no hay conexión, muestra `/offline`. **Nunca** guarda en caché `/api/*` ni páginas autenticadas. Convex usa WebSocket a `*.convex.cloud` y el SW no lo toca. La caché se versiona por build y se limpia en `activate`. |
| `src/app/offline/page.tsx` (nuevo) | Pantalla "Sin conexión" con botón Reintentar |
| `src/components/pwa/RegisterSW.tsx` (nuevo) | Registra `/sw.js` solo en el host app y solo en producción. Avisa con "Hay una versión nueva" y ofrece recargar cuando el SW se actualiza. |
| `src/components/pwa/InstallAppButton.tsx` (nuevo) | Botón **"Instalar app"** en el inicio de la app. En Chrome/Edge/Android usa `beforeinstallprompt`. En iPhone/iPad (Safari no tiene ese evento) abre un modal con los pasos Compartir → "Añadir a pantalla de inicio". Se oculta si ya se abrió como app instalada (`display-mode: standalone`). |
| `src/app/layout.tsx` | `appleWebApp` (capable, title, statusBarStyle), `icons.apple` y `themeColor` en `viewport`. Monta `RegisterSW`. |
| `src/proxy.ts` | Añade `/manifest.webmanifest`, `/sw.js`, `/icons/(.*)` y `/offline` a `isPublicRoute`. Sin esto, Clerk redirige a `/login` y el navegador no puede leer el manifest. En la portada estos archivos devuelven 404. |

En la app instalada, las ventanas de login de Clerk quedan dentro de la app
porque `/login` está en el mismo origen. Los enlaces externos (WhatsApp y las
herramientas) se abren en el navegador.

## Fase 4: pruebas

**Nuevas, en local** (Playwright contra `npm run dev`, con el host simulado mediante la
cabecera `Host`):

`tests/hosts.spec.ts`
- `terah2o.com/` → 200 con el contenido de la presentación y la sección de accesos
- `terah2o.com/operaciones` → 308 a `app.terah2o.com/operaciones`
- `terah2o.com/login` y `/pricing` → 308 a la app
- `www.terah2o.com/x` → 308 a `terah2o.com/x`
- `app.terah2o.com/presentacion` → 308 a `terah2o.com/`
- `terah2o.com/manifest.webmanifest` → 404
- La portada no recibe cabeceras ni cookies de Clerk (prueba de que no pasó por `auth()`)
- Accesos: las 3 herramientas apuntan a su ruta y abren en pestaña nueva con `noopener`.
  "Sistema" apunta a `app.terah2o.com`. Dimensionamiento no es un enlace.

`tests/pwa.spec.ts`
- `/manifest.webmanifest` → 200, JSON válido, con `display: standalone` y los íconos 192 y 512 (más uno maskable)
- Cada ícono del manifest responde 200 con `image/png` y el tamaño declarado
- Sin sesión, el manifest **no** redirige a `/login`
- El SW se registra y queda `activated`
- Sin red (`context.setOffline(true)`), al navegar se ve `/offline`
- `/api/*` nunca sale de la caché del SW
- El inicio de la app ya **no** tiene el botón "Presentación institucional"
- El botón "Instalar app" se oculta en modo standalone

**Pruebas existentes a actualizar**
- `tests/dominios.spec.ts`: hoy espera `www` como portada estática y apex → `www`.
  Se reescribe con el mapa nuevo (apex = portada, `www` → apex, `app` = sistema).
- `tests/portada.spec.ts`: se reescribe contra `terah2o.com` y la nueva sección de accesos.
- `tests/rutas-protegidas.spec.ts`: el ejemplo de `www.terah2o.com/operaciones` pasa a `app.terah2o.com`.

**Manual, una vez en producción**
- Instalar la app en Android (Chrome), en iPhone (Safari) y en escritorio (Chrome/Edge).
  Comprobar el ícono, la pantalla completa y que el login funcione dentro de la app.
- Abrir `chrome://inspect` → Application → Manifest y confirmar "Installable" sin errores.

## Fase 5: despliegue (Vercel, DNS y Clerk)

Esto se hace en los paneles, no en el código.

1. **Vercel**: en el proyecto `terah2o`, añadir `app.terah2o.com`. Dejar
   `terah2o.com` como dominio de la portada y `www.terah2o.com` con redirección a
   `terah2o.com`.
2. **DNS**: `CNAME app → cname.vercel-dns.com`, o el valor que indique Vercel.
   Si `app.terah2o.com/presentacion` ya responde hoy, el registro ya existe.
3. **Clerk**: si la instancia de producción está en el dominio raíz
   `terah2o.com`, los subdominios comparten la sesión y no hay que migrar nada.
   Solo hay que añadir `https://app.terah2o.com` en allowed origins/redirect URLs.
   **Revisarlo en el panel antes del deploy.** Si `CLERK_JWT_ISSUER_DOMAIN`
   cambiara, hay que actualizarlo en Vercel **y** en Convex, porque si no se pierden los datos (ver
   el riesgo del plan anterior).
4. Desplegar y correr `DOMAIN_TESTS=1 npm run test:e2e -- dominios.spec.ts portada.spec.ts`.
5. Criterio de cierre: iniciar sesión en `app.terah2o.com`, abrir `/operaciones/stock`
   y **ver el inventario**. Así se comprueba que Clerk y Convex siguen conectados.

## Orden y dependencias

```
Fase 2 (ícono) ──┐
Fase 1 (hosts) ──┼──► Fase 3 (PWA) ──► Fase 4 (pruebas) ──► Fase 5 (deploy)
                 └── independientes entre sí; se pueden hacer en paralelo
```

Todo el código (Fases 1 a 4) va en **una rama y un PR**. La Fase 5 necesita
acceso a los paneles de Vercel, DNS y Clerk.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El SW sirve una versión vieja después de un deploy | Caché versionada por build y aviso "Hay una versión nueva". Nunca se guardan HTML autenticados ni `/api`. |
| Configuración de Clerk distinta a la supuesta (instancia ligada a un subdominio) | Revisar el panel **antes** del deploy (Fase 5.3). Si hay que migrar dominio, se aplica el procedimiento de la Fase 1.4 del plan anterior. |
| Enlaces viejos a `terah2o.com/operaciones` o en correos ya enviados | Redirección 308 a la misma ruta en `app` |
| iOS limita las PWA (no hay botón de instalación nativo y el almacenamiento puede borrarse) | Modal de instrucciones. La app no depende de datos locales: todo está en Convex. |
| Hacer la app más visible sin haber corregido los fallos de seguridad de la revisión anterior | Se recomienda aplicar antes, o en el mismo ciclo, los arreglos 1 a 4 (vinculación por email, borrado de Clerk, consultas sin organización y mutaciones sin verificar el dueño del registro). |

## Pendiente de confirmar con José Alfredo
1. Que la portada (`terah2o.com`) **es la presentación**, más los accesos (ver el aviso al inicio).
2. La tarjeta de Dimensionamiento: ¿"Próximamente" visible o no se muestra? El plan
   asume "Próximamente" porque su mensaje dice "va a quedar vacío". Cambiarlo es una línea.
3. ¿Se sigue ofreciendo el PDF del brochure en la portada? El plan asume que sí
   (`/TERAH2O-Brochure.pdf`), porque hoy la presentación ya lo enlaza.
