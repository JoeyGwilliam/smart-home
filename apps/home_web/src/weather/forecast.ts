/**
 * The broad kind of weather, which decides the icon. Finer distinctions, such as "heavy" rain, are in the label.
 */
export type WeatherKind = 'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder'

/** What the sky is doing. */
export interface WeatherCondition {
  kind: WeatherKind
  /** A short description, such as "Light rain showers". */
  label: string
}

/** The weather at one moment. Temperatures are in °C and wind speeds in mph. */
export interface WeatherMoment {
  time: Date
  temperature: number
  condition: WeatherCondition
  /** Whether the sun is up, which decides between sun and moon icons. */
  isDaytime: boolean
  windSpeed: number
}

/** The weather now and over the coming hours. */
export interface Forecast {
  current: WeatherMoment
  today: {
    high: number
    low: number
    sunrise: Date
    sunset: Date
  }
  /** One forecast per hour, starting with the current hour. */
  hours: (WeatherMoment & {
    /** The chance of rain during the hour, as a percentage. */
    rainChance: number
  })[]
}
