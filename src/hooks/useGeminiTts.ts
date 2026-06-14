"use client";

import { useState, useCallback } from "react";
import { pcmToWav } from "@/lib/pcm-to-wav";

export function useGeminiTts() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(async (text: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/gemini-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error TTS");
      }

      const data = await response.json();

      if (data.audioData) {
        const sampleRate =
          parseInt(data.mimeType?.split("rate=")[1]) || 24000;
        const wavBlob = pcmToWav(data.audioData, sampleRate);
        const audio = new Audio(URL.createObjectURL(wavBlob));
        await audio.play();
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Fallo en la comunicacion con la IA";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { speak, loading, error };
}
