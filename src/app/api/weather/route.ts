import { NextRequest, NextResponse } from "next/server";

const OPENWEATHERMAP_KEY = process.env.OPENWEATHERMAP_KEY;

export async function GET(request: NextRequest) {
  if (!OPENWEATHERMAP_KEY) {
    return NextResponse.json(
      { error: "OPENWEATHERMAP_KEY not configured" },
      { status: 500 }
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
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${OPENWEATHERMAP_KEY}&units=metric&lang=es`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
