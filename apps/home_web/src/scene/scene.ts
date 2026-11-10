/** The stretch of the day, which decides the colours of the sky and where the sun or moon sits. */
export type TimeOfDay = 'sunrise' | 'day' | 'sunset' | 'night'

/** The weather as the backdrop draws it. It is coarser than a forecast, which tells light rain from heavy, for example. */
export type SceneWeather = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder'

/** What the backdrop behind every page shows. */
export interface Scene {
  timeOfDay: TimeOfDay
  weather: SceneWeather
  /**
   * How far the moon is through its cycle, from 0 up to, but not including, 1: 0 is a new moon, 0.25 a first quarter,
   * 0.5 a full moon and 0.75 a last quarter.
   */
  moonPhase: number
}
