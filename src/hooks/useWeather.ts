"use client";

import { useState, useCallback } from "react";
import type { WeatherData } from "@/types/weather";

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (location: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/weather?location=${encodeURIComponent(location)}`
      );

      if (!response.ok) {
        throw new Error("Error de conexión climática");
      }

      const data = await response.json();
      const forecast = data.list[0];
      const cityName = data.city?.name ?? location;

      let rain24h = 0;
      for (let i = 0; i < 8 && i < data.list.length; i++) {
        if (data.list[i].rain) {
          rain24h += data.list[i].rain["3h"] || 0;
        }
      }

      const weatherData: WeatherData = {
        temp: Math.round(forecast.main.temp),
        humidity: forecast.main.humidity,
        description: forecast.weather[0].description,
        pop: Math.round(forecast.pop * 100),
        rain24h: parseFloat(rain24h.toFixed(1)),
        cityName,
      };

      setWeather(weatherData);
      return weatherData;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { weather, fetchWeather, loading, error };
}
