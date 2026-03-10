"use client";

import { useState, useCallback } from "react";
import { GEMINI_SYSTEM_PROMPTS } from "@/lib/gemini-prompts";

interface UseGeminiOptions {
  context: keyof typeof GEMINI_SYSTEM_PROMPTS;
}

export function useGemini({ context }: UseGeminiOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (prompt: string): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const systemPrompt = GEMINI_SYSTEM_PROMPTS[context];
        if (!systemPrompt) {
          throw new Error(`Unknown context: ${context}`);
        }

        const response = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, systemPrompt }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Error en la solicitud");
        }

        const data = await response.json();
        return data.text;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo conectar con la IA";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [context]
  );

  return { generate, loading, error };
}
