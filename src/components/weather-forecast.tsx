/**
 * Weather Forecast Display Component
 *
 * Shows a localized weather forecast for the game window.
 * Used on the RSVP page and Home page.
 *
 * Two variants:
 * - "full": Shows golfability badge, summary, and hourly breakdown (RSVP page)
 * - "compact": Shows golfability badge and summary only (Home page event cards)
 */

import type { GameWeatherForecast } from "@/types/events";

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

function getGolfabilityStyles(score: number) {
  if (score >= 4) return { badge: "bg-teal-100 text-teal-800 border-teal-200", card: "border-teal-200 bg-teal-50/50" };
  if (score >= 3) return { badge: "bg-amber-100 text-amber-800 border-amber-200", card: "border-amber-200 bg-amber-50/50" };
  return { badge: "bg-red-100 text-red-800 border-red-200", card: "border-red-200 bg-red-50/50" };
}

function getConfidenceLabel(daysUntilGame: number): string {
  if (daysUntilGame > 4) return "Early Look";
  if (daysUntilGame > 2) return "Updated Forecast";
  if (daysUntilGame > 0) return "Game Day Forecast";
  return "Current Conditions";
}

export function WeatherForecast({
  forecast,
  variant = "full",
}: {
  forecast: GameWeatherForecast;
  variant?: "full" | "compact";
}) {
  const { summary, hourlyForecasts, sunrise, daysUntilGame } = forecast;
  const styles = getGolfabilityStyles(summary.golfabilityScore);
  const confidenceLabel = getConfidenceLabel(daysUntilGame);

  if (variant === "compact") {
    return (
      <div className={`rounded-lg border px-3 py-2 ${styles.card}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getWeatherEmoji(summary.condition)}</span>
            <div>
              <p className="text-xs font-medium text-gray-500">{confidenceLabel}</p>
              <p className={`text-sm font-semibold ${summary.golfabilityScore >= 4 ? "text-teal-700" : summary.golfabilityScore >= 3 ? "text-amber-700" : "text-red-700"}`}>
                {summary.golfabilityLabel}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              {summary.lowTemp}°–{summary.highTemp}°F
            </p>
            <p className="text-xs text-gray-500">
              {summary.avgWindSpeed} mph {summary.dominantWindDirection}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`rounded-lg border ${styles.card} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {getWeatherEmoji(summary.condition)} {confidenceLabel}
            </p>
            <p className={`mt-1 text-lg font-bold ${summary.golfabilityScore >= 4 ? "text-teal-700" : summary.golfabilityScore >= 3 ? "text-amber-700" : "text-red-700"}`}>
              {summary.golfabilityLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {summary.lowTemp}°–{summary.highTemp}°F
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>💨 {summary.avgWindSpeed}–{summary.maxWindSpeed} mph {summary.dominantWindDirection}</span>
          {summary.maxPrecipProbability > 0 && (
            <span className="text-blue-600">🌧 {summary.maxPrecipProbability}% rain</span>
          )}
          {summary.maxUvIndex >= 6 && (
            <span className="text-red-600">☀️ UV {summary.maxUvIndex} — sunscreen</span>
          )}
          <span className="text-gray-400">🌅 Sunrise {sunrise}</span>
        </div>
      </div>

      {/* Hourly timeline — show for forecasts within 3 days */}
      {daysUntilGame <= 3 && hourlyForecasts.length > 0 && (
        <div className="border-t border-gray-200 bg-white/60 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Hourly Forecast
          </p>
          <div className="flex gap-0 overflow-x-auto pb-1">
            {hourlyForecasts.map((h) => (
              <div
                key={h.hour}
                className="flex min-w-[56px] flex-shrink-0 flex-col items-center px-1.5 text-center"
              >
                <span className="text-xs font-medium text-gray-500">{h.time}</span>
                <span className="my-0.5 text-base">{getWeatherEmoji(h.weatherDescription)}</span>
                <span className="text-sm font-semibold text-gray-900">{h.temperature}°</span>
                <span className="text-[10px] text-gray-400">{h.windSpeed} mph</span>
                {h.precipitationProbability > 0 && (
                  <span className="text-[10px] text-blue-500">{h.precipitationProbability}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200/50 bg-white/30 px-4 py-2">
        <p className="text-center text-[11px] text-gray-400">
          Forecast for FRCC, Rancho Santa Fe
          {daysUntilGame > 3 ? " — updates as game day approaches" : ""}
        </p>
      </div>
    </div>
  );
}
