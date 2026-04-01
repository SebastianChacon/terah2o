import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

async function callGemini(
  prompt: string,
  systemInstruction: string,
  retryCount = 0
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
    }),
  });

  if (!response.ok) {
    if (response.status === 429 && retryCount < 5) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callGemini(prompt, systemInstruction, retryCount + 1);
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  return (
    result.candidates?.[0]?.content?.parts?.[0]?.text ??
    "Respuesta no generada."
  );
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { prompt, systemPrompt } = await request.json();

    if (!prompt || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing prompt or systemPrompt" },
        { status: 400 }
      );
    }

    const text = await callGemini(prompt, systemPrompt);
    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
