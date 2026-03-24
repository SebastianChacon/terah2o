import { Suspense } from "react";
import LoginContent from "./LoginContent";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05051a]" />}>
      <LoginContent />
    </Suspense>
  );
}
