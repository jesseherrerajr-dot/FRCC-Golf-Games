/**
 * Weather Service — Open-Meteo API integration
 *
 * Fetches hyper-localized hourly weather forecasts for Fairbanks Ranch Country Club
 * scoped to the game time window (based on first_tee_time and game_type).
 *
 * Open-Meteo: Free, no API key, no rate limits for reasonable usage.
 * Coordinates: FRCC, 15150 San Dieguito Rd, Rancho Santa Fe, CA 92067
 */

import type { GameType, HourlyForecast, GameWeatherForecast } from "@/types/events";
import { createAdminClient } from "@/lib/supabase/server";
import { formatGameDate } from "@/lib/format";

// Fairbanks Ranch Country Club coordinates
const FRCC_LATITUDE = 32.9881;
const FRCC_LONGITUDE = -117.1935;

// Game duration assumptions (in hours from first tee time)
const GAME_DURATION: Record<GameType, number> = {
  "18_holes": 4.5,
  "9_holes": 2.5,
};

// Add 30-min buffer before tee time and after expected finish
const BUFFER_BEFORE_MINUTES = 30;
const BUFFER_AFTER_MINUTES = 30;

// Cache staleness: re-fetch if older than this many hours
const CACHE_MAX_AGE_HOURS = 3;

// WMO Weather Codes → descriptions
// https://open-meteo.com/en/docs#weathervariables
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

// Wind degree → direction
function degreesToDirection(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Celsius to Fahrenheit
function cToF(celsius: number): number {
  return Math.round(celsius * 9 / 5 + 32);
}

// km/h to mph
function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

// Format hour to display string (e.g., 7 → "7 AM", 13 → "1 PM")
function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

// Format minutes to sunrise display (e.g., "6:12 AM")
function formatSunriseTime(isoTime: string): string {
  // Open-Meteo returns sunrise as ISO timestamp
  const date = new Date(isoTime);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/**
 * Calculate the game time window (start hour, end hour) in local time
 */
function getGameWindow(
  firstTeeTime: string,
  gameType: GameType
): { startHour: number; endHour: number } {
  const [h, m] = firstTeeTime.split(":").map(Number);
  const startMinutes = h * 60 + m - BUFFER_BEFORE_MINUTES;
  const durationMinutes = GAME_DURATION[gameType] * 60;
  const endMinutes = h * 60 + m + durationMinutes + BUFFER_AFTER_MINUTES;

  return {
    startHour: Math.max(0, Math.floor(startMinutes / 60)),
    endHour: Math.min(23, Math.ceil(endMinutes / 60)),
  };
}

/**
 * Calculate golfability score (1-5) based on weather conditions
 * 5 = Perfect | 4 = Great | 3 = Good | 2 = Fair | 1 = Poor
 */
function calculateGolfability(summary: {
  highTemp: number;
  lowTemp: number;
  maxWindSpeed: number;
  maxPrecipProbability: number;
  maxUvIndex: number;
  condition: string;
}): { score: number; label: string } {
  let score = 5;

  // Temperature penalties
  if (summary.highTemp > 100 || summary.lowTemp < 45) score -= 2;
  else if (summary.highTemp > 95 || summary.lowTemp < 50) score -= 1;

  // Wind penalties
  if (summary.maxWindSpeed > 25) score -= 2;
  else if (summary.maxWindSpeed > 15) score -= 1;

  // Precipitation penalties
  if (summary.maxPrecipProbability > 70) score -= 2;
  else if (summary.maxPrecipProbability > 40) score -= 1;

  // Thunderstorm / heavy rain
  const severeConditions = ["Thunderstorm", "Heavy rain", "Violent rain showers"];
  if (severeConditions.some((c) => summary.condition.includes(c))) score -= 1;

  // Clamp to 1-5
  score = Math.max(1, Math.min(5, score));

  const labels: Record<number, string> = {
    5: "Perfect conditions",
    4: "Great day for golf",
    3: "Good — playable conditions",
    2: "Fair — bring layers/rain gear",
    1: "Tough conditions expected",
  };

  return { score, label: labels[score] };
}

/**
 * Fetch weather forecast from Open-Meteo API
 */
async function fetchFromOpenMeteo(
  gameDate: string,
  firstTeeTime: string,
  gameType: GameType
): Promise<GameWeatherForecast | null> {
  const { startHour, endHour } = getGameWindow(firstTeeTime, gameType);

  const params = new URLSearchParams({
    latitude: FRCC_LATITUDE.toString(),
    longitude: FRCC_LONGITUDE.toString(),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "uv_index",
      "is_day",
    ].join(","),
    daily: "sunrise",
    start_date: gameDate,
    end_date: gameDate,
    timezone: "America/Los_Angeles",
    temperature_unit: "celsius", // We'll convert to F
    wind_speed_unit: "kmh",     // We'll convert to mph
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  try {
    const response = await fetch(url, { next: { revalidate: 0 } });
    if (!response.ok) {
      console.error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (!data.hourly || !data.hourly.time) {
      console.error("Open-Meteo returned empty hourly data");
      return null;
    }

    // Parse hourly data for the game window
    const hourlyForecasts: HourlyForecast[] = [];
    const hourlyTimes: string[] = data.hourly.time;

    for (let i = 0; i < hourlyTimes.length; i++) {
      // hourlyTimes[i] is like "2026-03-14T07:00"
      const hour = parseInt(hourlyTimes[i].slice(11, 13));
      if (hour < startHour || hour > endHour) continue;

      hourlyForecasts.push({
        hour,
        time: formatHour(hour),
        temperature: cToF(data.hourly.temperature_2m[i]),
        apparentTemperature: cToF(data.hourly.apparent_temperature[i]),
        precipitationProbability: data.hourly.precipitation_probability[i] ?? 0,
        weatherCode: data.hourly.weather_code[i] ?? 0,
        weatherDescription: WMO_CODES[data.hourly.weather_code[i]] || "Unknown",
        windSpeed: kmhToMph(data.hourly.wind_speed_10m[i]),
        windDirection: degreesToDirection(data.hourly.wind_direction_10m[i] ?? 0),
        uvIndex: Math.round(data.hourly.uv_index[i] ?? 0),
        isDay: data.hourly.is_day?.[i] === 1,
      });
    }

    if (hourlyForecasts.length === 0) return null;

    // Calculate summary stats
    const temps = hourlyForecasts.map((h) => h.temperature);
    const winds = hourlyForecasts.map((h) => h.windSpeed);
    const precips = hourlyForecasts.map((h) => h.precipitationProbability);
    const uvs = hourlyForecasts.map((h) => h.uvIndex);
    const windGusts = data.hourly.wind_gusts_10m
      ? hourlyForecasts.map((_, idx) => {
          const globalIdx = hourlyTimes.findIndex(
            (t: string) => parseInt(t.slice(11, 13)) === hourlyForecasts[idx]?.hour
          );
          return kmhToMph(data.hourly.wind_gusts_10m[globalIdx] ?? 0);
        })
      : winds;

    // Most common wind direction
    const dirCounts: Record<string, number> = {};
    hourlyForecasts.forEach((h) => {
      dirCounts[h.windDirection] = (dirCounts[h.windDirection] || 0) + 1;
    });
    const dominantWindDirection = Object.entries(dirCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "N";

    // Dominant weather condition (most severe)
    const weatherCodes = hourlyForecasts.map((h) => h.weatherCode);
    const maxCode = Math.max(...weatherCodes);
    const condition = WMO_CODES[maxCode] || "Clear sky";

    // Calculate days until game
    const today = new Date();
    const [gy, gm, gd] = gameDate.split("-").map(Number);
    const gameDay = new Date(gy, gm - 1, gd);
    const daysUntilGame = Math.round((gameDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Sunrise
    const sunrise = data.daily?.sunrise?.[0]
      ? formatSunriseTime(data.daily.sunrise[0])
      : "N/A";

    const summaryData = {
      highTemp: Math.max(...temps),
      lowTemp: Math.min(...temps),
      maxWindSpeed: Math.max(...winds),
      maxWindGust: Math.max(...windGusts),
      avgWindSpeed: Math.round(winds.reduce((a, b) => a + b, 0) / winds.length),
      dominantWindDirection,
      maxPrecipProbability: Math.max(...precips),
      maxUvIndex: Math.max(...uvs),
      condition,
      golfabilityScore: 0,
      golfabilityLabel: "",
    };

    const golfability = calculateGolfability(summaryData);
    summaryData.golfabilityScore = golfability.score;
    summaryData.golfabilityLabel = golfability.label;

    return {
      gameDate,
      fetchedAt: new Date().toISOString(),
      daysUntilGame,
      sunrise,
      hourlyForecasts,
      summary: summaryData,
    };
  } catch (error) {
    console.error("Failed to fetch weather from Open-Meteo:", error);
    return null;
  }
}

/**
 * Get weather forecast for a game — uses cache with fallback to live API
 */
export async function getGameWeather(
  eventId: string,
  gameDate: string,
  firstTeeTime: string,
  gameType: GameType
): Promise<GameWeatherForecast | null> {
  const supabase = createAdminClient();

  // Check cache first
  const { data: cached } = await supabase
    .from("weather_cache")
    .select("forecast_data, fetched_at")
    .eq("event_id", eventId)
    .eq("game_date", gameDate)
    .single();

  if (cached) {
    const fetchedAt = new Date(cached.fetched_at);
    const ageHours = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);

    if (ageHours < CACHE_MAX_AGE_HOURS) {
      return cached.forecast_data as unknown as GameWeatherForecast;
    }
  }

  // Fetch fresh data from Open-Meteo
  const forecast = await fetchFromOpenMeteo(gameDate, firstTeeTime, gameType);
  if (!forecast) return cached?.forecast_data as unknown as GameWeatherForecast ?? null;

  // Upsert cache
  await supabase.from("weather_cache").upsert(
    {
      event_id: eventId,
      game_date: gameDate,
      forecast_data: forecast,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,game_date" }
  );

  return forecast;
}

/**
 * Generate weather HTML snippet for emails
 */
export function generateWeatherEmailHtml(
  forecast: GameWeatherForecast,
  variant: "invite" | "reminder" | "confirmation" = "invite"
): string {
  const { summary, hourlyForecasts, sunrise, daysUntilGame } = forecast;

  // Confidence label based on days out
  const confidenceLabel =
    daysUntilGame > 4
      ? "Early Look"
      : daysUntilGame > 2
        ? "Updated Forecast"
        : "Game Day Forecast";

  // Golfability color
  const golfabilityColor =
    summary.golfabilityScore >= 4
      ? "#059669" // green
      : summary.golfabilityScore >= 3
        ? "#d97706" // amber
        : "#dc2626"; // red

  // Weather icon based on condition
  const weatherEmoji = getWeatherEmoji(summary.condition);

  // Build hourly timeline (compact for email)
  const hourlyHtml = hourlyForecasts
    .filter((_, i) => i % 1 === 0) // show every hour
    .map(
      (h) => `
      <td style="padding: 6px 8px; text-align: center; font-size: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 600; color: #374151;">${h.time}</div>
        <div style="font-size: 16px; margin: 4px 0;">${getWeatherEmoji(h.weatherDescription)}</div>
        <div style="color: #065f46; font-weight: 600;">${h.temperature}°F</div>
        <div style="color: #6b7280; font-size: 11px;">${h.windSpeed} mph ${h.windDirection}</div>
        ${h.precipitationProbability > 0 ? `<div style="color: #2563eb; font-size: 11px;">${h.precipitationProbability}% rain</div>` : ""}
      </td>
    `
    )
    .join("");

  return `
    <div style="background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
            ${weatherEmoji} Forecast for ${formatGameDate(forecast.gameDate)}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: ${golfabilityColor};">
            ${summary.golfabilityLabel}
          </p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #065f46;">
            ${summary.lowTemp}°–${summary.highTemp}°F
          </p>
        </div>
      </div>

      <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px;">
        <span style="font-size: 13px; color: #374151;">
          💨 Wind: ${summary.avgWindSpeed}–${summary.maxWindSpeed} mph ${summary.dominantWindDirection}
        </span>
        ${summary.maxPrecipProbability > 0 ? `<span style="font-size: 13px; color: #2563eb;">🌧 ${summary.maxPrecipProbability}% chance of rain</span>` : ""}
        ${summary.maxUvIndex >= 6 ? `<span style="font-size: 13px; color: #dc2626;">☀️ High UV (${summary.maxUvIndex}) — sunscreen recommended</span>` : ""}
        <span style="font-size: 13px; color: #6b7280;">🌅 Sunrise: ${sunrise}</span>
      </div>

      ${variant !== "invite" || daysUntilGame <= 3 ? `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
          <tr>${hourlyHtml}</tr>
        </table>
      </div>
      ` : ""}

      <p style="margin: 8px 0 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
        FRCC, Rancho Santa Fe &middot; ${confidenceLabel}${daysUntilGame > 3 ? " — updates as game day approaches" : ""}
      </p>
    </div>
  `;
}

/**
 * Get weather emoji based on condition string
 */
function getWeatherEmoji(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes("thunder")) return "⛈️";
  if (lower.includes("heavy rain") || lower.includes("violent")) return "🌧️";
  if (lower.includes("rain") || lower.includes("drizzle") || lower.includes("shower")) return "🌦️";
  if (lower.includes("snow")) return "🌨️";
  if (lower.includes("fog")) return "🌫️";
  if (lower.includes("overcast")) return "☁️";
  if (lower.includes("partly")) return "⛅";
  if (lower.includes("mainly clear")) return "🌤️";
  if (lower.includes("clear")) return "☀️";
  return "🌤️";
}

/**
 * Get golfability color class for Tailwind UI
 */
export function getGolfabilityColor(score: number): string {
  if (score >= 4) return "text-teal-700 bg-teal-50 border-teal-200";
  if (score >= 3) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

/**
 * Get golfability badge color for Tailwind UI
 */
export function getGolfabilityBadgeColor(score: number): string {
  if (score >= 4) return "bg-teal-100 text-teal-800";
  if (score >= 3) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}
