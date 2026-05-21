"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

type FlowMode = "signIn" | "signUp";

// @convex-dev/auth Password provider throws PascalCase codes like "InvalidSecret",
// "InvalidAccountId", "AccountAlreadyExists" — not the plain-English strings the
// original catch was checking. This function maps the real codes to Spanish.
function parseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes("InvalidSecret") ||
    msg.includes("Invalid password") ||
    msg.includes("wrong password") ||
    msg.includes("incorrect password")
  ) {
    return "Contraseña incorrecta. Verifica tus credenciales.";
  }
  if (
    msg.includes("AccountAlreadyExists") ||
    msg.includes("already exists") ||
    msg.includes("already registered")
  ) {
    return "Ya existe una cuenta con ese correo. Inicia sesión.";
  }
  if (
    msg.includes("InvalidAccountId") ||
    msg.includes("not found") ||
    msg.includes("no account") ||
    msg.includes("Could not find")
  ) {
    return "No existe cuenta con ese correo. Regístrate primero.";
  }
  return "Error de autenticación. Verifica tus datos e intenta de nuevo.";
}

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Validate the ?next= param: reject absolute URLs to prevent open-redirect phishing.
  // An attacker could craft /login?next=https://evil.com to redirect users off-site.
  const rawNext = searchParams.get("next") ?? "/operaciones";
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/operaciones";

  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
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

  // Guardamos los datos del form en un ref para que el efecto pueda accederlos
  // después de que la sesión Convex esté completamente establecida.
  const pendingUpsertRef = useRef<{
    email: string;
    name?: string;
    orgName?: string;
  } | null>(null);

  // Cuando la autenticación es confirmada por Convex, sincronizamos el perfil
  // y redirigimos. Esto evita la condición de carrera donde upsertCurrentUser
  // era llamado antes de que el token JWT estuviera disponible.
  useEffect(() => {
    if (!isAuthenticated) return;

    setRedirecting(true);
    const pending = pendingUpsertRef.current;
    pendingUpsertRef.current = null;

    if (pending) {
      // fire-and-forget: don't gate redirect on upsert
      upsertUser({ email: pending.email, name: pending.name })
        .then(() => {
          if (pending.orgName) return createOrganization({ name: pending.orgName });
        })
        .catch(console.error);
    }

    router.replace(nextPath);
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Guardar datos ANTES de signIn para que el efecto los recoja
      pendingUpsertRef.current = {
        email,
        name: name || undefined,
        orgName: mode === "signUp" ? (orgName || undefined) : undefined,
      };

      await signIn("password", {
        email,
        password,
        flow: mode,
        ...(mode === "signUp" ? { name } : {}),
      });
      // Redirect immediately — don't wait for isAuthenticated to update in React state,
      // since the WebSocket reconnection loop can delay or prevent that transition.
      router.replace(nextPath);
    } catch (err: unknown) {
      pendingUpsertRef.current = null;
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || redirecting) {
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

  // iOS Safari auto-zooms any input with font-size < 16px and never zooms back.
  const inputClass =
    "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-base placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all";

  return (
    <div className="min-h-screen bg-[#05051a] flex items-center justify-center px-4">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(59,130,246,0.06)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
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

        {/* Card */}
        <div className="bg-[#0a1120] border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Tabs */}
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
            {/* Nombre (solo registro) */}
            {mode === "signUp" && (
              <div>
                <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ing. Juan Pérez"
                  className={inputClass}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@ptap.ec"
                className={inputClass}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            {/* Nombre de organización (solo registro) */}
            {mode === "signUp" && (
              <div>
                <label className="block text-[0.68rem] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                  Nombre de tu PTAP / Organización
                </label>
                <input
                  type="text"
                  name="organization"
                  autoComplete="organization"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="PTAP Municipio de Loja"
                  className={inputClass}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-[0.15em] rounded-lg transition-all shadow-lg shadow-blue-500/20 mt-2"
            >
              {loading
                ? "Procesando..."
                : mode === "signIn"
                ? "Ingresar"
                : "Crear cuenta"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-white/20 text-[0.62rem] font-mono mt-6 tracking-wide">
          TeraH2O · Acceso Seguro · Ecuador
        </p>
      </div>
    </div>
  );
}
