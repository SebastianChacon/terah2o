"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

// verify = OTP post-registro | trust = Client Trust / MFA en sign-in
type FlowMode = "signIn" | "signUp" | "verify" | "trust";

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
      if (code === "form_code_incorrect") return "Código incorrecto. Revisa tu correo e intenta de nuevo.";
      if (code === "verification_expired") return "El código expiró. Solicita uno nuevo.";
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
  // OTP code para verificación de email
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clerkTicket = searchParams.get("__clerk_ticket");

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
          await completeSession(result.createdSessionId, setSignInActive);
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
    userName?: string
  ) {
    setRedirecting(true);
    await setter!({ session: sessionId });
    try {
      await upsertUser({ name: userName });
      if (userName && orgName) await createOrganization({ name: orgName });
    } catch {
      // non-fatal: se sincronizará en la próxima carga
    }
  }

  async function startEmailSecondFactor(): Promise<boolean> {
    const factors = signIn!.supportedSecondFactors ?? [];
    const emailFactor = factors.find((f) => f.strategy === "email_code");
    if (!emailFactor || !("emailAddressId" in emailFactor)) return false;
    await signIn!.prepareSecondFactor({
      strategy: "email_code",
      emailAddressId: emailFactor.emailAddressId as string,
    });
    setOtpCode("");
    setMode("trust");
    return true;
  }

  async function handleSignInResult(
    result: Awaited<ReturnType<NonNullable<typeof signIn>["create"]>>
  ) {
    if (result.status === "complete") {
      await completeSession(result.createdSessionId, setSignInActive);
      return;
    }
    if (
      result.status === "needs_client_trust" ||
      result.status === "needs_second_factor"
    ) {
      const started = await startEmailSecondFactor();
      if (!started) {
        setError("Requiere verificación adicional. Contacta al administrador.");
      }
      return;
    }
    if (result.status === "needs_new_password") {
      setError("Debes restablecer tu contraseña. Usa «Olvidé mi contraseña» o contacta al administrador.");
      return;
    }
    setError("No se pudo completar el inicio de sesión. Intenta de nuevo.");
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

        await handleSignInResult(result);
      } else {
        // ── Sign Up ──────────────────────────────────────────────────────────
        const result = await signUp!.create({
          emailAddress: email,
          password,
          firstName: name.split(" ")[0] || name,
          lastName: name.split(" ").slice(1).join(" ") || undefined,
        });

        if (result.status === "complete") {
          // Clerk no requiere verificación de email (configuración de desarrollo)
          await completeSession(result.createdSessionId, setSignUpActive, name);
        } else if (result.status === "missing_requirements") {
          // Clerk requiere verificación de email — enviar código OTP
          await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
          setMode("verify");
        } else {
          setError("Registro incompleto. Intenta de nuevo.");
        }
      }
    } catch (err: unknown) {
      setError(parseClerkError(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Verificación OTP (registro o Client Trust en sign-in) ───────────────
  async function handleTrustVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signInLoaded) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signIn!.attemptSecondFactor({
        strategy: "email_code",
        code: otpCode,
      });
      await handleSignInResult(result);
    } catch (err: unknown) {
      setError(parseClerkError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signUp!.attemptEmailAddressVerification({ code: otpCode });

      if (result.status === "complete") {
        await completeSession(result.createdSessionId, setSignUpActive, name);
      } else {
        setError("Verificación incompleta. Intenta de nuevo.");
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

  // ── Pantalla OTP: registro (verify) o Client Trust (trust) ──────────────
  if (mode === "verify" || mode === "trust") {
    const isTrust = mode === "trust";
    const onSubmit = isTrust ? handleTrustVerify : handleVerify;
    const backMode = isTrust ? "signIn" : "signUp";
    const backLabel = isTrust ? "← Volver al inicio de sesión" : "← Volver al registro";
    const title = isTrust ? "Verifica este dispositivo" : "Verifica tu correo";
    const subtitle = isTrust
      ? `Por seguridad, enviamos un código a ${email}. Ingrésalo para continuar.`
      : `Enviamos un código de 6 dígitos a ${email}. Ingrésalo abajo.`;

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
            <p className="text-white/60 text-sm mb-1">{title}</p>
            <p className="text-white/30 text-xs mb-6">
              {subtitle.split(email).map((part, i, arr) =>
                i < arr.length - 1 ? (
                  <span key={i}>
                    {part}
                    <span className="text-blue-400">{email}</span>
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                  Código de verificación
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  placeholder="123456"
                  className={inputClass + " text-center text-xl tracking-[0.4em]"}
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-[0.15em] rounded-lg transition-all shadow-lg shadow-blue-500/20 mt-2"
              >
                {loading ? "Verificando..." : "Confirmar código"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode(backMode);
                  setError(null);
                  setOtpCode("");
                }}
                className="w-full text-white/30 hover:text-white/50 text-xs font-mono uppercase tracking-widest py-2 transition-colors"
              >
                {backLabel}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }


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
              <input type="password" name="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} placeholder="••••••••" className={inputClass} />
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
