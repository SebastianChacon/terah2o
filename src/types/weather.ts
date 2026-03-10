export interface WeatherData {
  temp: number;
  humidity: number;
  description: string;
  pop: number;
  rain24h: number;
  cityName: string;
}

export interface ForecastEntry {
  dt: number;
  main: {
    temp: number;
    humidity: number;
  };
  weather: {
    description: string;
  }[];
  pop: number;
  rain?: {
    "3h"?: number;
  };
}
