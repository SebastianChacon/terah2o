"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSubscription } from "@/hooks/useSubscription";
import Link from "next/link";

type FlowMode = "signIn" | "signUp";
type AuthView = "auth" | "resetRequest" | "resetCode";

function parseClerkError(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors: Array<{ code: string; message: string }> }).errors;
    if (errors?.length > 0) {
      const code = errors[0].code;
      if (code === "form_password_incorrect") return "Contraseña incorrecta. Verifica tus credenciales.";
      if (code === "form_password_pwned") return "Esta contraseña aparece en filtraciones de datos. Elige una contraseña más segura.";
      if (code === "form_identifier_not_found") return "No existe cuenta con ese correo. Regístrate primero.";
      if (code === "form_identifier_exists") return "Ya existe una cuenta con ese correo. Inicia sesión.";
      if (code === "session_exists") return "Ya tienes sesión activa.";
      // ── Recuperación de contraseña ──────────────────────────────────────
      if (code === "form_code_incorrect") return "Código incorrecto. Revisa el correo e intenta de nuevo.";
      if (code === "verification_expired") return "El código expiró. Solicita uno nuevo.";
      if (code === "verification_failed") return "Demasiados intentos fallidos. Solicita un código nuevo.";
      if (code === "form_password_length_too_short") return "La contraseña debe tener al menos 8 caracteres.";
      if (code === "form_password_validation_failed") return "La contraseña no cumple los requisitos de seguridad.";
      if (code === "strategy_for_user_invalid") return "Esta cuenta no admite recuperación por correo. Contacta al administrador.";
      if (code === "too_many_requests" || code === "rate_limit_exceeded") return "Demasiados intentos. Espera un minuto e intenta de nuevo.";
      return errors[0].message ?? "Error de autenticación.";
    }
  }
  return "Error de autenticación. Verifica tus datos e intenta de nuevo.";
}

const inputClass =
  "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-base placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all";
const passwordInputClass = inputClass + " pr-10";
const labelClass = "block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5";
const submitClass =
  "w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-[0.15em] rounded-lg transition-all shadow-lg shadow-blue-500/20 mt-2";

/** Input de contraseña con ojo mostrar/ocultar. Definido a nivel de módulo para
 *  que React no lo remonte (y pierda el foco) en cada render del formulario. */
function PasswordField({
  value,
  onChange,
  testId,
  toggleTestId,
  autoComplete,
  placeholder = "••••••••",
}: {
  value: string;
  onChange: (v: string) => void;
  testId: string;
  toggleTestId: string;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        name="password"
        data-testid={testId}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={8}
        placeholder={placeholder}
        className={passwordInputClass}
      />
      <button
        type="button"
        data-testid={toggleTestId}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
      >
        {show ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

function Banner({ tone, testId, children }: { tone: "error" | "info"; testId: string; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "bg-red-500/10 border-red-500/20 text-red-400"
      : "bg-blue-500/10 border-blue-500/20 text-blue-300";
  return (
    <div className={`border rounded-lg px-4 py-3 ${styles}`} data-testid={testId}>
      <p className="text-xs">{children}</p>
    </div>
  );
}

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("next") ?? searchParams.get("redirect_url");
  let nextPath = "/operaciones";
  if (rawRedirect) {
    try {
      const parsed = rawRedirect.startsWith("http")
        ? new URL(rawRedirect).pathname
        : decodeURIComponent(rawRedirect);
      if (parsed.startsWith("/") && !parsed.startsWith("//")) nextPath = parsed;
    } catch {
      if (rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")) {
        nextPath = rawRedirect;
      }
    }
  }

  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const { isSignedIn } = useAuth();
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
  const [subWaitTimedOut, setSubWaitTimedOut] = useState(false);

  // ── Recuperación de contraseña ────────────────────────────────────────────
  // "auth" = pestañas Ingresar/Registrarse; las otras dos son sub-pantallas.
  const [view, setView] = useState<AuthView>("auth");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  // Estado de suscripcion del usuario recien autenticado. useSubscription tambien
  // fija la cookie __convexSubStatus que lee el proxy.
  const { isActive, isLoading: subLoading } = useSubscription();

  const clerkTicket = searchParams.get("__clerk_ticket");
  // E2E tests pass email via URL so upsert can merge old records when JWT lacks email claim
  const emailFromParam = searchParams.get("__email") ?? undefined;

  // Fallback: si la consulta de suscripcion tarda demasiado (Convex lento/caido),
  // no atrapar al usuario en el spinner — continuar al destino y dejar que el
  // proxy aplique el gate por cookie.
  useEffect(() => {
    if (!isSignedIn) return;
    const t = setTimeout(() => setSubWaitTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [isSignedIn]);

  // Único punto de navegación post-login (evita doble router.replace).
  // Espera a conocer el estado de suscripcion para enrutar: con plan activo va al
  // destino; sin plan va a /pricing (un usuario recien registrado no debe acceder
  // a la app hasta contratar un plan).
  useEffect(() => {
    if (!isSignedIn) return;
    if (subLoading) {
      if (!subWaitTimedOut) return; // esperar el estado real de la suscripcion
      router.replace(nextPath); // fallback por timeout: no bloquear por outage
      return;
    }
    router.replace(isActive ? nextPath : "/pricing");
  }, [isSignedIn, subLoading, subWaitTimedOut, isActive, nextPath, router]);

  // Sign-in con ticket (__clerk_ticket) — usado en E2E y enlaces mágicos de Clerk
  useEffect(() => {
    if (!signInLoaded || !clerkTicket || isSignedIn || redirecting) return;
    let cancelled = false;
    (async () => {
      setRedirecting(true);
      setError(null);
      try {
        const result = await signIn!.create({ strategy: "ticket", ticket: clerkTicket });
        if (cancelled) return;
        if (result.status === "complete") {
          await completeSession(result.createdSessionId, setSignInActive, undefined, emailFromParam);
        } else {
          setRedirecting(false);
          setError("No se pudo iniciar sesión con el enlace. Intenta con email y contraseña.");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setRedirecting(false);
          setError(parseClerkError(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signInLoaded, clerkTicket, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Activar sesión Clerk + sincronizar Convex; la redirección la hace el useEffect
  async function completeSession(
    sessionId: string | null,
    setter: ((args: { session: string | null }) => Promise<void>) | undefined,
    userName?: string,
    userEmail?: string
  ) {
    setRedirecting(true);
    await setter!({ session: sessionId });
    try {
      // Pass email from client — Clerk JWT template may not include the email claim.
      await upsertUser({ name: userName, email: userEmail });
      if (userName && orgName) await createOrganization({ name: orgName });
    } catch {
      // non-fatal: se sincronizará en la próxima carga
    }
  }

  // ── Submit principal (signIn / signUp) ────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "signIn") {
        // ── Sign In ──────────────────────────────────────────────────────────
        const result = await signIn!.create({
          identifier: email,
          password,
        });

        if (result.status === "complete") {
          await completeSession(result.createdSessionId, setSignInActive, undefined, email);
        } else if (result.status === "needs_new_password") {
          setError('Debes crear una contraseña nueva. Usa "¿Olvidaste tu contraseña?" para recibir un código.');
        } else {
          setError("No se pudo completar el inicio de sesión. Intenta de nuevo.");
        }
      } else {
        // ── Sign Up ──────────────────────────────────────────────────────────
        const result = await signUp!.create({
          emailAddress: email,
          password,
          firstName: name.split(" ")[0] || name,
          lastName: name.split(" ").slice(1).join(" ") || undefined,
        });

        if (result.status === "complete") {
          await completeSession(result.createdSessionId, setSignUpActive, name, email);
        } else {
          setError("Registro incompleto. Verifica que la verificación de email esté desactivada en el Dashboard de Clerk.");
        }
      }
    } catch (err: unknown) {
      setError(parseClerkError(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Recuperación de contraseña ────────────────────────────────────────────
  function goToView(next: AuthView) {
    setView(next);
    setError(null);
    setInfo(null);
    if (next === "auth" || next === "resetRequest") {
      setResetCode("");
      setNewPassword("");
    }
  }

  // Paso A — Clerk envía un código de 6 dígitos al correo.
  async function sendResetCode(): Promise<boolean> {
    if (!signInLoaded) return false;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signIn!.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setInfo(`Enviamos un código de 6 dígitos a ${email}. Revisa tu bandeja y el correo no deseado.`);
      return true;
    } catch (err: unknown) {
      setError(parseClerkError(err));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    if (await sendResetCode()) setView("resetCode");
  }

  // Paso B — validar código y fijar la contraseña nueva. Si Clerk responde
  // "complete" la sesión ya queda creada: se reutiliza completeSession para que
  // la navegación siga saliendo del único useEffect (evita doble router.replace).
  async function handleResetConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!signInLoaded) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const result = await signIn!.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode,
        password: newPassword,
      });

      if (result.status === "complete") {
        await completeSession(result.createdSessionId, setSignInActive, undefined, email);
      } else if (result.status === "needs_second_factor") {
        setError("Tu cuenta usa verificación en dos pasos. Contacta al administrador para completar el restablecimiento.");
      } else {
        setError("No se pudo restablecer la contraseña. Solicita un código nuevo.");
      }
    } catch (err: unknown) {
      setError(parseClerkError(err));
    } finally {
      setLoading(false);
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

  // ── Pantalla principal signIn / signUp / recuperación ────────────────────
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
          {view === "auth" && (
          <>
          <div className="flex gap-1 mb-6 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            {(["signIn", "signUp"] as const).map((m) => (
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
              <PasswordField
                value={password}
                onChange={setPassword}
                testId="password-input"
                toggleTestId="toggle-password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              />
              {mode === "signIn" && (
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    data-testid="forgot-password-link"
                    onClick={() => goToView("resetRequest")}
                    className="text-[0.66rem] font-mono uppercase tracking-widest text-blue-400/70 hover:text-blue-400 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
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

            {error && <Banner tone="error" testId="auth-error">{error}</Banner>}

            {/* Requerido por Clerk Smart CAPTCHA en flujos de registro personalizados */}
            {mode === "signUp" && <div id="clerk-captcha" />}

            <button type="submit" disabled={loading} className={submitClass}>
              {loading ? "Procesando..." : mode === "signIn" ? "Ingresar" : "Crear cuenta"}
            </button>
          </form>
          </>
          )}

          {/* ── Paso A: pedir el código al correo ─────────────────────────── */}
          {view === "resetRequest" && (
            <form onSubmit={handleResetRequest} className="space-y-4" data-testid="reset-request-form">
              <div className="mb-2">
                <h2 className="text-white text-sm font-bold uppercase tracking-widest">
                  Restablecer contraseña
                </h2>
                <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
                  Escribe el correo de tu cuenta y te enviaremos un código de 6 dígitos
                  para crear una contraseña nueva.
                </p>
              </div>

              <div>
                <label className={labelClass}>Correo electrónico</label>
                <input
                  type="email"
                  name="email"
                  data-testid="reset-email-input"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@ptap.ec"
                  className={inputClass}
                />
              </div>

              {error && <Banner tone="error" testId="reset-error">{error}</Banner>}

              <button type="submit" disabled={loading} data-testid="reset-request-submit" className={submitClass}>
                {loading ? "Enviando..." : "Enviar código"}
              </button>

              <button
                type="button"
                data-testid="reset-back-link"
                onClick={() => goToView("auth")}
                className="w-full text-center text-[0.66rem] font-mono uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors pt-1"
              >
                Volver a ingresar
              </button>
            </form>
          )}

          {/* ── Paso B: código + contraseña nueva ─────────────────────────── */}
          {view === "resetCode" && (
            <form onSubmit={handleResetConfirm} className="space-y-4" data-testid="reset-code-form">
              <div className="mb-2">
                <h2 className="text-white text-sm font-bold uppercase tracking-widest">
                  Código de verificación
                </h2>
              </div>

              {info && <Banner tone="info" testId="reset-info">{info}</Banner>}

              <div>
                <label className={labelClass}>Código de 6 dígitos</label>
                <input
                  type="text"
                  name="code"
                  data-testid="reset-code-input"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                  required
                  placeholder="000000"
                  className={inputClass + " tracking-[0.5em] font-mono"}
                />
              </div>

              <div>
                <label className={labelClass}>Contraseña nueva</label>
                <PasswordField
                  value={newPassword}
                  onChange={setNewPassword}
                  testId="new-password-input"
                  toggleTestId="toggle-new-password"
                  autoComplete="new-password"
                />
                <p className="text-white/25 text-[0.65rem] mt-1.5">Mínimo 8 caracteres.</p>
              </div>

              {error && <Banner tone="error" testId="reset-error">{error}</Banner>}

              <button type="submit" disabled={loading} data-testid="reset-confirm-submit" className={submitClass}>
                {loading ? "Restableciendo..." : "Restablecer contraseña"}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  data-testid="reset-resend"
                  disabled={loading}
                  onClick={() => { void sendResetCode(); }}
                  className="text-[0.66rem] font-mono uppercase tracking-widest text-blue-400/70 hover:text-blue-400 disabled:text-white/20 transition-colors"
                >
                  Reenviar código
                </button>
                <button
                  type="button"
                  data-testid="reset-back-link"
                  onClick={() => goToView("auth")}
                  className="text-[0.66rem] font-mono uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
                >
                  Volver a ingresar
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-white/20 text-[0.62rem] font-mono mt-6 tracking-wide">
          TeraH2O · Acceso Seguro · Ecuador
        </p>
      </div>
    </div>
  );
}
