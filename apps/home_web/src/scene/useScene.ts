import { describeMoonPhase } from '@/scene/describeMoonPhase'
import { describeSceneWeather, describeTimeOfDay } from '@/scene/describeScene'
import type { Scene } from '@/scene/scene'
import { useSettings } from '@/settings/useSettings'
import { useNow } from '@/time/useNow'
import { useForecast } from '@/weather/useForecast'

// Used for the live time of day until the forecast, which knows the real sunrise and sunset, has loaded.
const TYPICAL_SUNRISE_HOUR = 7
const TYPICAL_SUNSET_HOUR = 19

/**
 * Provides the scene for the backdrop to show. Each half of it, the time of day and the weather, is either the one
 * chosen in this device's settings or, when the setting is "live", the real one from the clock and the forecast.
 * The moon is always in its real phase.
 *
 * @returns The scene, kept up to date as time passes and the forecast refreshes. Until the forecast has loaded, the
 *   live weather is clear and the live time of day assumes a typical sunrise and sunset.
 */
export function useScene(): Scene {
  const [{ sceneTime, sceneWeather }] = useSettings()
  const now = useNow()
  const forecast = useForecast().data

  const sunrise = forecast?.today.sunrise ?? atHourToday(now, TYPICAL_SUNRISE_HOUR)
  const sunset = forecast?.today.sunset ?? atHourToday(now, TYPICAL_SUNSET_HOUR)
  const liveWeather = forecast ? describeSceneWeather(forecast.current.condition.kind) : 'clear'

  return {
    timeOfDay: sceneTime === 'live' ? describeTimeOfDay(now, sunrise, sunset) : sceneTime,
    weather: sceneWeather === 'live' ? liveWeather : sceneWeather,
    moonPhase: describeMoonPhase(now),
  }
}

function atHourToday(now: Date, hour: number): Date {
  const time = new Date(now)
  time.setHours(hour, 0, 0, 0)
  return time
}
