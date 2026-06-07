"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

type FlowMode = "signIn" | "signUp";

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
      return errors[0].message ?? "Error de autenticación.";
    }
  }
  return "Error de autenticación. Verifica tus datos e intenta de nuevo.";
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
  const [showPassword, setShowPassword] = useState(false);

  const clerkTicket = searchParams.get("__clerk_ticket");
  // E2E tests pass email via URL so upsert can merge old records when JWT lacks email claim
  const emailFromParam = searchParams.get("__email") ?? undefined;

  // Único punto de navegación post-login (evita doble router.replace)
  useEffect(() => {
    if (isSignedIn) {
      router.replace(nextPath);
    }
  }, [isSignedIn, nextPath, router]);

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
          setError("Debes restablecer tu contraseña. Contacta al administrador.");
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
  const passwordInputClass = inputClass + " pr-10";

  // ── Pantalla principal signIn / signUp ───────────────────────────────────
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  data-testid="password-input"
                  autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className={passwordInputClass}
                />
                <button
                  type="button"
                  data-testid="toggle-password"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? (
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

            {/* Requerido por Clerk Smart CAPTCHA en flujos de registro personalizados */}
            {mode === "signUp" && <div id="clerk-captcha" />}

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
