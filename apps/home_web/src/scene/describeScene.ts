import type { SceneWeather, TimeOfDay } from '@/scene/scene'
import type { WeatherKind } from '@/weather/forecast'

// The sky shows a sunrise or sunset from this long before the sun crosses the horizon until this long after.
const TWILIGHT_MILLISECONDS = 40 * 60_000

/**
 * Describes the time of day from where the sun is.
 *
 * @param now The current time.
 * @param sunrise When the sun rises today.
 * @param sunset When the sun sets today.
 * @returns "sunrise" or "sunset" for the 40 minutes either side of each, "day" between them, and otherwise "night".
 */
export function describeTimeOfDay(now: Date, sunrise: Date, sunset: Date): TimeOfDay {
  if (Math.abs(now.getTime() - sunrise.getTime()) <= TWILIGHT_MILLISECONDS) return 'sunrise'
  if (Math.abs(now.getTime() - sunset.getTime()) <= TWILIGHT_MILLISECONDS) return 'sunset'
  return now > sunrise && now < sunset ? 'day' : 'night'
}

const SCENE_WEATHER_BY_KIND: Record<WeatherKind, SceneWeather> = {
  clear: 'clear',
  // The clear scene already has a couple of clouds in it.
  partlyCloudy: 'clear',
  cloudy: 'cloudy',
  fog: 'fog',
  drizzle: 'drizzle',
  rain: 'rain',
  snow: 'snow',
  thunder: 'thunder',
}

/**
 * Chooses how the backdrop draws a kind of weather.
 *
 * @param kind The kind of weather in a forecast.
 * @returns The weather for the backdrop to show.
 */
export function describeSceneWeather(kind: WeatherKind): SceneWeather {
  return SCENE_WEATHER_BY_KIND[kind]
}
