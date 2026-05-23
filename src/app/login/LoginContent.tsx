"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Usar la API legacy de Clerk (v6-compatible) que expone { isLoaded, signIn, setActive }
// La API "future" de Clerk v7 usa signals (useSignIn → SignInSignalValue) — diferente contrato.
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
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirigir si ya hay sesión activa (ej: usuario recarga /login)
  useEffect(() => {
    if (isSignedIn && !redirecting) {
      setRedirecting(true);
      router.replace(nextPath);
    }
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "signIn") {
        // ── Sign In ────────────────────────────────────────────────────────
        const result = await signIn!.create({
          identifier: email,
          password,
        });

        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId });
          setRedirecting(true);
          // Pequeña pausa para que Clerk establezca la cookie __session
          await new Promise((r) => setTimeout(r, 300));
          try {
            // clerkId lo obtiene el servidor de identity.subject (JWT de Clerk)
            await upsertUser({});
          } catch {
            // non-fatal: se sincronizará en la próxima carga
          }
          router.replace(nextPath);
        } else {
          setError("Requiere verificación adicional. Contacta al administrador.");
        }
      } else {
        // ── Sign Up ────────────────────────────────────────────────────────
        const result = await signUp!.create({
          emailAddress: email,
          password,
          firstName: name.split(" ")[0] || name,
          lastName: name.split(" ").slice(1).join(" ") || undefined,
        });

        if (result.status === "complete") {
          await setSignUpActive!({ session: result.createdSessionId });
          setRedirecting(true);
          await new Promise((r) => setTimeout(r, 300));
          try {
            await upsertUser({ name });
            if (orgName) await createOrganization({ name: orgName });
          } catch {
            // non-fatal
          }
          router.replace(nextPath);
        } else if (result.status === "missing_requirements") {
          setError("Verifica tu correo electrónico para completar el registro.");
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
            {(["signIn", "signUp"] as FlowMode[]).map((m) => (
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
