import { headers } from "next/headers";

/** Clima actual. Si no hay datos, Flow no menciona el clima en ningún lado. */
export type WeatherCondition = "clear" | "clouds" | "fog" | "rain" | "snow" | "storm";

export type WeatherNow = {
  condition: WeatherCondition;
  label: string;
  temperatureC: number;
  isDay: boolean;
  place: string | null;
};

export type WeatherPlace = {
  latitude: number;
  longitude: number;
  place: string | null;
};

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const REVALIDATE_SECONDS = 900;
const TIMEOUT_MS = 3500;

/** Códigos WMO de Open-Meteo. Solo los que la API puede devolver. */
const WMO: Record<number, { condition: WeatherCondition; label: string }> = {
  0: { condition: "clear", label: "Despejado" },
  1: { condition: "clear", label: "Mayormente despejado" },
  2: { condition: "clouds", label: "Parcialmente nublado" },
  3: { condition: "clouds", label: "Nublado" },
  45: { condition: "fog", label: "Niebla" },
  48: { condition: "fog", label: "Niebla con escarcha" },
  51: { condition: "rain", label: "Llovizna ligera" },
  53: { condition: "rain", label: "Llovizna" },
  55: { condition: "rain", label: "Llovizna intensa" },
  56: { condition: "rain", label: "Llovizna helada" },
  57: { condition: "rain", label: "Llovizna helada intensa" },
  61: { condition: "rain", label: "Lluvia ligera" },
  63: { condition: "rain", label: "Lluvia" },
  65: { condition: "rain", label: "Lluvia fuerte" },
  66: { condition: "rain", label: "Lluvia helada" },
  67: { condition: "rain", label: "Lluvia helada fuerte" },
  71: { condition: "snow", label: "Nieve ligera" },
  73: { condition: "snow", label: "Nieve" },
  75: { condition: "snow", label: "Nieve fuerte" },
  77: { condition: "snow", label: "Aguanieve" },
  80: { condition: "rain", label: "Chubascos ligeros" },
  81: { condition: "rain", label: "Chubascos" },
  82: { condition: "rain", label: "Chubascos fuertes" },
  85: { condition: "snow", label: "Chubascos de nieve" },
  86: { condition: "snow", label: "Chubascos de nieve fuertes" },
  95: { condition: "storm", label: "Tormenta" },
  96: { condition: "storm", label: "Tormenta con granizo" },
  99: { condition: "storm", label: "Tormenta fuerte con granizo" },
};

/** Coordenadas de respaldo cuando la request no trae geolocalización (por ejemplo en local). */
const TIMEZONE_PLACES: Record<string, { latitude: number; longitude: number; place: string }> = {
  "America/Costa_Rica": { latitude: 9.93, longitude: -84.08, place: "San José" },
  "America/Monterrey": { latitude: 25.69, longitude: -100.31, place: "Monterrey" },
  "America/Mexico_City": { latitude: 19.43, longitude: -99.13, place: "Ciudad de México" },
  "America/Guatemala": { latitude: 14.63, longitude: -90.51, place: "Guatemala" },
  "America/Panama": { latitude: 8.98, longitude: -79.52, place: "Panamá" },
  "America/Bogota": { latitude: 4.71, longitude: -74.07, place: "Bogotá" },
  "America/Lima": { latitude: -12.05, longitude: -77.04, place: "Lima" },
  "America/Santiago": { latitude: -33.45, longitude: -70.67, place: "Santiago" },
  "America/Argentina/Buenos_Aires": { latitude: -34.6, longitude: -58.38, place: "Buenos Aires" },
  "America/Montevideo": { latitude: -34.9, longitude: -56.16, place: "Montevideo" },
  "America/Santo_Domingo": { latitude: 18.49, longitude: -69.93, place: "Santo Domingo" },
  "Europe/Madrid": { latitude: 40.42, longitude: -3.7, place: "Madrid" },
};

export function describeWeatherCode(code: number): { condition: WeatherCondition; label: string } {
  return WMO[code] ?? { condition: "clouds", label: "Sin datos claros" };
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded || null;
  } catch {
    return value.trim() || null;
  }
}

function parseCoordinate(value: string | null, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > max) return null;
  return parsed;
}

export function placeFromTimeZone(timeZone: string): WeatherPlace | null {
  const known = TIMEZONE_PLACES[timeZone];
  if (!known) return null;
  return { latitude: known.latitude, longitude: known.longitude, place: known.place };
}

/** Geolocalización aproximada que Vercel adjunta a cada request. En local no existe. */
export function placeFromHeaders(
  get: (name: string) => string | null,
  timeZone: string,
): WeatherPlace | null {
  const latitude = parseCoordinate(get("x-vercel-ip-latitude"), 90);
  const longitude = parseCoordinate(get("x-vercel-ip-longitude"), 180);
  if (latitude == null || longitude == null) return placeFromTimeZone(timeZone);
  return { latitude, longitude, place: decodeHeader(get("x-vercel-ip-city")) };
}

export async function resolveWeatherPlace(timeZone: string): Promise<WeatherPlace | null> {
  try {
    const store = await headers();
    return placeFromHeaders((name) => store.get(name), timeZone);
  } catch {
    return placeFromTimeZone(timeZone);
  }
}

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
};

export async function fetchWeatherNow(place: WeatherPlace): Promise<WeatherNow | null> {
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", place.latitude.toFixed(3));
  url.searchParams.set("longitude", place.longitude.toFixed(3));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("timezone", "auto");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OpenMeteoResponse;
    const code = data.current?.weather_code;
    const temperature = data.current?.temperature_2m;
    if (typeof code !== "number" || typeof temperature !== "number") return null;
    const { condition, label } = describeWeatherCode(code);
    return {
      condition,
      label,
      temperatureC: Math.round(temperature),
      isDay: data.current?.is_day !== 0,
      place: place.place,
    };
  } catch {
    return null;
  }
}

export async function getWeatherNow(timeZone: string): Promise<WeatherNow | null> {
  const place = await resolveWeatherPlace(timeZone);
  if (!place) return null;
  return fetchWeatherNow(place);
}
