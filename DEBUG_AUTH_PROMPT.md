# PROMPT PARA CLAUDE CODE — DEBUG AUTENTICACIÓN TERAH2O

Copia y pega esto directamente en Claude Code (`claude` en terminal desde la raíz del proyecto).

---

## CONTEXTO DEL PROBLEMA

Estoy en el proyecto **TeraH2O** — plataforma SaaS Next.js 16 + Convex + Clerk.
El sistema de autenticación está roto. El login nunca completa la redirección y los tests
de Playwright fallan con timeout. Necesito que me ayudes a encontrar el error de forma
sistemática, parte por parte, sin disparar herramientas innecesarias.

**Stack exacto:**
- Next.js 16.1.6 (Turbopack, proxy.ts en lugar de middleware.ts)
- Convex 1.32.0 → backend recomienda actualizar a 1.39.1
- `@clerk/nextjs` ^7.4.1 (con imports legacy `@clerk/nextjs/legacy`)
- Playwright 1.60.0 para tests E2E

---

## ERRORES CONOCIDOS (no repetir investigación ya hecha)

### Error 1 — Convex runtime (CRÍTICO)
```
[CONVEX A(auth:signIn)] Could not find public function for 'auth:signIn'.
Did you forget to run `npx convex dev`?
```
**Diagnóstico parcial:** `convex/auth.ts` está vacío (solo `export {}`). El proyecto migró
de `@convex-dev/auth` a Clerk, pero ALGO sigue llamando `auth:signIn` de Convex. No sé
desde dónde.

### Error 2 — Playwright timeout (consecuencia del Error 1)
```
TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
waiting for navigation until "load"
```
Los 3 tests que fallan son los que necesitan login exitoso:
- `tests/auth.spec.ts:36` — successful login reaches protected route
- `tests/auth.spec.ts:62` — authenticated user visiting /login is redirected
- `tests/auth.spec.ts:86` — sign out clears session

Los 4 tests que pasan son: login page loads, wrong password shows error,
unauthenticated user blocked.

### Error 3 — Clerk v7 API legacy
`LoginContent.tsx` importa `useSignIn / useSignUp` de `@clerk/nextjs/legacy` pero usa
`useAuth` de `@clerk/nextjs`. Posible mezcla de APIs incompatibles en v7.

### Error 4 — Race condition potencial en completeSession
```typescript
// completeSession en LoginContent.tsx
await setter!({ session: sessionId });  // setActive de Clerk
setRedirecting(true);
await new Promise((r) => setTimeout(r, 300)); // pausa artificial
await upsertUser({ name: userName });   // Convex mutation
router.replace(nextPath);              // navegación
```
El timer de 300ms puede no ser suficiente para que Clerk establezca `__session` antes de que
Convex intente leer el JWT.

---

## PLAN DE TRABAJO — EJECUTAR EN ESTE ORDEN EXACTO

Usa **caveman debugging** (console.log temporales bien colocados) para los pasos de inspección.
Sé quirúrgico: lee solo los archivos necesarios para cada paso antes de actuar.

---

### FASE 1 — ENCONTRAR QUIÉN LLAMA `auth:signIn` (máx 3 archivos a leer)

**Objetivo:** eliminar el error de Convex runtime que es el más grave.

1. Buscar con grep en todo el proyecto (excluyendo node_modules y .next):
   ```
   grep -r "auth:signIn\|auth\.signIn\|@convex-dev/auth" src/ convex/ --include="*.ts" --include="*.tsx"
   ```
2. También buscar en package.json si `@convex-dev/auth` sigue instalado como dependencia.
3. Si encuentras el archivo culpable: eliminar la referencia o comentarla con un TODO.
4. Si convex/auth.ts está vacío y nada lo llama: el error puede ser que `convex/_generated/`
   está desactualizado. Verificar si existe `convex/_generated/api.d.ts` y si exporta `auth`.

**Criterio de éxito:** `npx convex dev` corre sin mostrar ese error al intentar login.

---

### FASE 2 — VERIFICAR CONFIGURACIÓN DE CLERK (solo leer, no modificar todavía)

Archivos a leer en este orden (uno a la vez, parar cuando encuentres el problema):
1. `convex/auth.config.ts` — verificar que `CLERK_JWT_ISSUER_DOMAIN` está referenciado
2. `.env.local` — verificar que `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` existen
3. `src/ConvexClientProvider.tsx` — verificar que ClerkProvider wrappea correctamente ConvexProvider

**Caveman debug a agregar temporalmente en `LoginContent.tsx`:**
```typescript
// Al inicio de handleSubmit, ANTES del try:
console.log("[DEBUG handleSubmit] signInLoaded:", signInLoaded, "signUpLoaded:", signUpLoaded);
console.log("[DEBUG handleSubmit] mode:", mode, "email:", email);
```

**Y en completeSession:**
```typescript
console.log("[DEBUG completeSession] sessionId:", sessionId);
console.log("[DEBUG completeSession] Llamando setter...");
// después de await setter:
console.log("[DEBUG completeSession] setter completado, setRedirecting true");
// después del timeout:
console.log("[DEBUG completeSession] timeout listo, llamando upsertUser");
// después de upsertUser:
console.log("[DEBUG completeSession] upsertUser OK, router.replace →", nextPath);
```

**Criterio de éxito:** en el log del navegador (DevTools Console) se ve la secuencia completa
sin que se corte. Si se corta en "Llamando setter..." → el problema es Clerk setActive.
Si se corta después → el problema es upsertUser (Convex).

---

### FASE 3 — ARREGLAR EL API MISMATCH DE CLERK v7

**Hipótesis:** mezclar `@clerk/nextjs/legacy` con `@clerk/nextjs` puede causar estado
inconsistente en v7.

1. Leer `src/app/login/LoginContent.tsx` completo (ya lo tienes en contexto si corriste Fase 2).
2. Verificar si `@clerk/nextjs` v7 todavía soporta el import `/legacy`. Si no existe:
   ```
   node -e "require('@clerk/nextjs/legacy')"
   ```
3. Si el módulo existe, verificar si `useSignIn` de legacy retorna el mismo shape que
   la documentación de Clerk v7 espera.
4. **Fix probable:** migrar de `/legacy` a la API actual de Clerk v7:
   ```typescript
   // ANTES:
   import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
   import { useAuth } from "@clerk/nextjs";
   
   // DESPUÉS (Clerk v7 API actual):
   import { useSignIn, useSignUp, useAuth } from "@clerk/nextjs";
   ```
   Verificar que el shape de `useSignIn()` en v7 sigue siendo `{ isLoaded, signIn, setActive }`.

**Criterio de éxito:** no hay imports de `/legacy` y TypeScript compila sin errores.

---

### FASE 4 — ARREGLAR LA RACE CONDITION EN completeSession

**Hipótesis:** `setTimeout(300ms)` no garantiza que Clerk haya flusheado `__session` al
navegador antes de que Convex intente autenticar con ese JWT.

**Fix a aplicar:**
```typescript
async function completeSession(
  sessionId: string | null,
  setter: ((args: { session: string | null }) => Promise<void>) | undefined,
  userName?: string
) {
  // 1. Primero activar la sesión de Clerk
  await setter!({ session: sessionId });
  setRedirecting(true);
  
  // 2. Esperar a que isSignedIn flipee a true (en lugar de timer arbitrario)
  // El useEffect de isSignedIn hará el router.replace — NO hacerlo aquí también.
  // Solo sincronizar Convex en background:
  try {
    await upsertUser({ name: userName });
    if (userName && orgName) await createOrganization({ name: orgName });
  } catch {
    // non-fatal
  }
  // NO router.replace aquí — lo hace el useEffect cuando isSignedIn cambia
}
```
Y asegurarse de que el `useEffect` es el ÚNICO que hace `router.replace`:
```typescript
useEffect(() => {
  if (isSignedIn && !redirecting) {
    setRedirecting(true);
    router.replace(nextPath);
  }
}, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Criterio de éxito:** el log de DEBUG muestra que router.replace se llama UNA sola vez,
desde el useEffect, después de que `isSignedIn` es true.

---

### FASE 5 — CORRER PLAYWRIGHT Y VERIFICAR

Antes de correr los tests, verificar que existe un usuario de prueba en Clerk Dashboard:
- Email: `carlos.test.777@ptap.ec` (o el que esté en `TEST_EMAIL` env var)
- Password: `segura1234` (o el que esté en `TEST_PASSWORD` env var)

Si no existe, crear uno en Clerk Dashboard → Users → Create user.

**Correr solo los tests de auth:**
```bash
npx playwright test tests/auth.spec.ts --headed --reporter=line
```

Si los tests siguen fallando, agregar más debug al test para ver qué URL tiene al timeout:
```typescript
// En auth.spec.ts, dentro del test "successful login reaches protected route":
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
await page.goto("/login");
// ... después del click:
console.log("URL actual:", page.url());
const title = await page.title();
console.log("Título:", title);
```

**Si falla solo con credenciales pero pasa en modo headed:** el problema es CAPTCHA de Clerk.
Agregar en `.env.local`: `CLERK_DISABLE_CAPTCHA=1` (solo para dev/test).

**Criterio de éxito:** los 7 tests de `auth.spec.ts` pasan en verde.

---

### FASE 6 — LIMPIAR DEBUG Y VALIDAR

1. Remover TODOS los `console.log("[DEBUG..."` que agregamos.
2. Correr `npm run lint` para verificar que no quedaron errores de TypeScript.
3. Correr los tests una vez más en modo headless:
   ```bash
   npx playwright test tests/auth.spec.ts --reporter=line
   ```
4. Verificar manualmente que el flujo de registro funciona:
   - Ir a `/login` → tab "Registrarse"
   - Ingresar email, password, nombre, org
   - Si Clerk pide verificación OTP → verificar que llega el email y el código funciona
   - Confirmar que después del registro llega a `/operaciones`

---

## RESTRICCIONES IMPORTANTES

- **No tocar** `convex/schema.ts` a menos que sea absolutamente necesario
- **No tocar** `src/proxy.ts` — la lógica de `clerkMiddleware` está correcta
- **Nunca crear** `src/middleware.ts` — Next.js 16 lanza error si coexiste con `proxy.ts`
- **No actualizar** Convex a 1.39.1 todavía — podría introducir breaking changes

## ARCHIVOS CLAVE PARA REFERENCIA RÁPIDA

```
src/app/login/LoginContent.tsx     ← lógica principal de auth UI
src/ConvexClientProvider.tsx       ← providers de Clerk + Convex
convex/auth.config.ts              ← configuración JWT de Clerk en Convex
convex/auth.ts                     ← VACÍO (migración de @convex-dev/auth)
convex/users.ts                    ← upsertCurrentUser mutation
src/proxy.ts                       ← guard de auth (clerkMiddleware)
tests/auth.spec.ts                 ← suite de Playwright
```

## SEÑAL DE ÉXITO FINAL

- `npx convex dev` NO muestra `Could not find public function for 'auth:signIn'`
- Login con email/password completa y redirige a `/operaciones` en < 3 segundos
- Registro crea cuenta, pasa verificación OTP si aplica, y redirige correctamente
- `npx playwright test tests/auth.spec.ts` → 7 passed, 0 failed
