import type { SceneWeather, TimeOfDay } from '@/scene/scene'
import type { SceneDesign } from '@/scenes/sceneDesign'

// The site's own scenes, one for each time of day in each weather, as they are designed until someone changes them.
// Each is simply a stack of the site's own layers (see builtInLayers), chosen by the rules below: grey weather hides the
// sun and stars behind grey clouds, wet weather brings puddles and umbrellas, and so on.

export const TIMES_OF_DAY: TimeOfDay[] = ['sunrise', 'day', 'sunset', 'night']
export const SCENE_WEATHERS: SceneWeather[] = ['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder']

export const TIME_OF_DAY_NAMES: Record<TimeOfDay, string> = { sunrise: 'Sunrise', day: 'Day', sunset: 'Sunset', night: 'Night' }
export const WEATHER_NAMES: Record<SceneWeather, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  thunder: 'Thunder',
}

/** The layer that holds the sun or moon at each time of day. */
const SUN_OR_MOON_LAYERS: Record<TimeOfDay, string> = { sunrise: 'sun-sunrise', day: 'sun-day', sunset: 'sun-sunset', night: 'moon' }

const WET_WEATHER: SceneWeather[] = ['drizzle', 'rain', 'thunder']

/**
 * Gives the id of the site's own scene for a time of day and weather.
 *
 * @returns Such as "day-rain".
 */
export function getBuiltInSceneId(timeOfDay: TimeOfDay, weather: SceneWeather): string {
  return `${timeOfDay}-${weather}`
}

/**
 * Designs one of the site's own scenes, by choosing which of the site's own layers it stacks up, back first.
 *
 * @returns The scene, as the site designs it.
 */
export function designBuiltInScene(timeOfDay: TimeOfDay, weather: SceneWeather): SceneDesign {
  const isClear = weather === 'clear'
  const showsSky = isClear || weather === 'cloudy'
  const isWet = WET_WEATHER.includes(weather)
  const isNight = timeOfDay === 'night'

  const layerIds = [
    'sky',
    isNight && isClear && 'stars',
    showsSky && SUN_OR_MOON_LAYERS[timeOfDay],
    'fair-clouds',
    (weather === 'cloudy' || isWet) && 'grey-clouds',
    weather === 'snow' && 'snow-clouds',
    'grass',
    isWet && 'puddles',
    weather === 'snow' && 'snowman',
    `animals-${timeOfDay}`,
    isWet && 'umbrellas',
    timeOfDay === 'day' && isClear && 'butterflies',
    isNight && showsSky && 'fireflies',
    weather === 'fog' && 'fog',
    weather === 'drizzle' && 'drizzle',
    (weather === 'rain' || weather === 'thunder') && 'rain',
    weather === 'snow' && 'snow',
    weather === 'thunder' && 'lightning',
  ].filter((layerId): layerId is string => typeof layerId === 'string')

  return { name: `${TIME_OF_DAY_NAMES[timeOfDay]}, ${WEATHER_NAMES[weather].toLowerCase()}`, look: { timeOfDay, weather }, layerIds }
}

/** One of the site's own scenes, which the backdrop shows at its time of day in its weather. */
export interface BuiltInScene {
  /** Such as "day-rain". */
  id: string
  design: SceneDesign
}

/** Every scene of the site's own, in the order the pixel art page lists them. */
export const BUILT_IN_SCENES: BuiltInScene[] = TIMES_OF_DAY.flatMap((timeOfDay) =>
  SCENE_WEATHERS.map((weather) => ({ id: getBuiltInSceneId(timeOfDay, weather), design: designBuiltInScene(timeOfDay, weather) })),
)
