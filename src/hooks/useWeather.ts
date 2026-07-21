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
      if (!response.ok) throw new Error("Error de conexión climática");
      const data: WeatherData = await response.json();
      setWeather(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeatherByCoords = useCallback(
    async (lat: number, lon: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        if (!response.ok) throw new Error("Error de conexión climática");
        const data: WeatherData = await response.json();
        setWeather(data);
        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { weather, fetchWeather, fetchWeatherByCoords, loading, error };
}
