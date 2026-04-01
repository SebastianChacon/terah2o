import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export async function GET(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");

  if (!location) {
    return NextResponse.json(
      { error: "Missing location parameter" },
      { status: 400 }
    );
  }

  try {
    const now = new Date();
    const month = now.toLocaleString("es-EC", { month: "long" });
    const year = now.getFullYear();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Ubicación: ${location}. Mes actual: ${month} ${year}. Proporciona una estimación climática típica para este lugar y época del año.`,
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [
            {
              text: `Eres un servicio de estimación climática para plantas de tratamiento de agua potable en Ecuador y Latinoamérica. Dado el nombre de una ubicación y el mes actual, proporciona estimaciones climáticas basadas en patrones históricos y conocimiento de la región. Responde ÚNICAMENTE con un JSON válido con estos campos: temp (entero °C), humidity (entero 0-100), description (condición en español, ej: "Parcialmente nublado"), pop (probabilidad de lluvia entero 0-100), rain24h (lluvia estimada 24h en mm, un decimal), cityName (nombre de la ciudad).`,
            },
          ],
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              temp: { type: "INTEGER" },
              humidity: { type: "INTEGER" },
              description: { type: "STRING" },
              pop: { type: "INTEGER" },
              rain24h: { type: "NUMBER" },
              cityName: { type: "STRING" },
            },
            required: ["temp", "humidity", "description", "pop", "rain24h", "cityName"],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Sin respuesta de Gemini");
    }

    const weatherData = JSON.parse(text);
    return NextResponse.json(weatherData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
