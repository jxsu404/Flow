import { cache } from "react";
import { DEFAULT_TIMEZONE } from "./datetime";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REVALIDATE_SECONDS = 20 * 60;
const FETCH_TIMEOUT_MS = 4_000;

/** Default place for Flow: matches America/Costa_Rica. Never shown as coordinates. */
export const WEATHER_LOCATION = {
  latitude: 9.9281,
  longitude: -84.0907,
  label: "San José",
} as const;

export type WeatherMood = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm";

export type WeatherSnapshot = {
  observedAt: string;
  timeZone: string;
  locationLabel: string;
  temperatureC: number;
  weatherCode: number;
  precipitationMm: number;
  rainMm: number;
  snowfallCm: number;
  cloudCoverPct: number;
  isDay: boolean;
  mood: WeatherMood;
};

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  weather_code?: number;
  precipitation?: number;
  rain?: number;
  showers?: number;
  snowfall?: number;
  cloud_cover?: number;
  is_day?: number;
};

type OpenMeteoResponse = {
  timezone?: string;
  current?: OpenMeteoCurrent;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function weatherMoodFromCode(
  weatherCode: number,
  rainMm: number,
  snowfallCm: number,
): WeatherMood {
  if (weatherCode >= 95) return "storm";
  if (snowfallCm > 0 || (weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return "snow";
  }
  if (
    rainMm > 0 ||
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return "rain";
  }
  if (weatherCode === 45 || weatherCode === 48) return "fog";
  if (weatherCode >= 2) return "cloudy";
  return "clear";
}

export function weatherEmoji(mood: WeatherMood, isDay: boolean): string {
  if (mood === "storm") return "⛈️";
  if (mood === "snow") return "❄️";
  if (mood === "rain") return "🌧️";
  if (mood === "fog") return "🌫️";
  if (mood === "cloudy") return "☁️";
  return isDay ? "☀️" : "🌙";
}

function parseCurrent(payload: unknown, fallbackTimeZone: string): WeatherSnapshot | null {
  if (!isRecord(payload) || !isRecord(payload.current)) return null;
  const current = payload.current as OpenMeteoCurrent;
  const temperatureC = asNumber(current.temperature_2m);
  const weatherCode = asNumber(current.weather_code);
  if (temperatureC === null || weatherCode === null || !current.time) return null;

  const rainMm = (asNumber(current.rain) ?? 0) + (asNumber(current.showers) ?? 0);
  const snowfallCm = asNumber(current.snowfall) ?? 0;
  const precipitationMm = asNumber(current.precipitation) ?? rainMm;
  const cloudCoverPct = asNumber(current.cloud_cover) ?? 0;
  const isDay = (asNumber(current.is_day) ?? 1) === 1;
  const timeZone =
    typeof payload.timezone === "string" && payload.timezone.length > 0
      ? payload.timezone
      : fallbackTimeZone;

  return {
    observedAt: current.time,
    timeZone,
    locationLabel: WEATHER_LOCATION.label,
    temperatureC,
    weatherCode,
    precipitationMm,
    rainMm,
    snowfallCm,
    cloudCoverPct,
    isDay,
    mood: weatherMoodFromCode(weatherCode, rainMm, snowfallCm),
  };
}

async function fetchCurrentWeather(timeZone: string): Promise<WeatherSnapshot | null> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(WEATHER_LOCATION.latitude));
  url.searchParams.set("longitude", String(WEATHER_LOCATION.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,precipitation,rain,showers,snowfall,cloud_cover,is_day",
  );
  url.searchParams.set("timezone", timeZone || DEFAULT_TIMEZONE);
  url.searchParams.set("forecast_days", "1");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as OpenMeteoResponse;
    return parseCurrent(body, timeZone);
  } catch {
    return null;
  }
}

/** Deduped per request; HTTP cache ~20 min. Returns null on any failure. */
export const getCurrentWeather = cache(async (timeZone: string): Promise<WeatherSnapshot | null> => {
  return fetchCurrentWeather(timeZone);
});
