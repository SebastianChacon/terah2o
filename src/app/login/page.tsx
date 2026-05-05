import { Suspense } from "react";
import LoginContent from "./LoginContent";

function LoginFallback() {
  return (
    <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-white/30 text-xs font-mono tracking-widest uppercase">
          Cargando...
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
