import { NextRequest, NextResponse } from "next/server";
import {
  GEMINI_SYSTEM_PROMPTS,
  GEMINI_GENERATION_CONFIGS,
  DEFAULT_GENERATION_CONFIG,
} from "@/lib/gemini-prompts";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

async function callGemini(
  prompt: string,
  systemInstruction: string,
  generationConfig: { maxOutputTokens: number; temperature: number },
  retryCount = 0
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        ...generationConfig,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 429 && retryCount < 5) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callGemini(prompt, systemInstruction, generationConfig, retryCount + 1);
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  // gemini-2.5 may return multiple parts (thought + response). Collect all non-thought text.
  const parts: Array<{ text?: string; thought?: boolean }> =
    result.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");
  return text || "Respuesta no generada.";
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { prompt, systemPrompt, context } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const resolvedSystemPrompt = context
      ? GEMINI_SYSTEM_PROMPTS[context]
      : systemPrompt;

    if (!resolvedSystemPrompt) {
      return NextResponse.json(
        { error: context ? `Unknown context: ${context}` : "Missing systemPrompt" },
        { status: 400 }
      );
    }

    const generationConfig =
      context
        ? (GEMINI_GENERATION_CONFIGS[context] ?? DEFAULT_GENERATION_CONFIG)
        : DEFAULT_GENERATION_CONFIG;

    const text = await callGemini(prompt, resolvedSystemPrompt, generationConfig);
    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
