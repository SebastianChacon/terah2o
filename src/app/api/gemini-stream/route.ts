import { NextRequest, NextResponse } from "next/server";
import {
  GEMINI_SYSTEM_PROMPTS,
  GEMINI_GENERATION_CONFIGS,
  DEFAULT_GENERATION_CONFIG,
} from "@/lib/gemini-prompts";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: resolvedSystemPrompt }] },
        generationConfig,
      }),
    });

    if (!geminiResponse.ok) {
      return NextResponse.json(
        { error: `Gemini stream error: ${geminiResponse.status}` },
        { status: geminiResponse.status }
      );
    }

    return new NextResponse(geminiResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
