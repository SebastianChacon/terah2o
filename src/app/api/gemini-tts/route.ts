import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Aoede" },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini TTS API error: ${response.status}`);
    }

    const result = await response.json();
    const part = result.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData
    );

    if (!part?.inlineData?.data) {
      return NextResponse.json(
        { error: "No audio generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      audioData: part.inlineData.data,
      mimeType: part.inlineData.mimeType,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
