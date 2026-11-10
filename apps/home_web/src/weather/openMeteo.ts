import type { Forecast, WeatherCondition, WeatherKind } from '@/weather/forecast'

/** Where the forecast is for. Open-Meteo works out the local time zone, and so what "today" is, from this. */
const LOCATION = { name: 'Bristol', latitude: 51.4545, longitude: -2.5879 }

// Open-Meteo is free for non-commercial use and needs no key, so the browser can ask it directly.
const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?' +
  new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    current: 'temperature_2m,weather_code,is_day,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
    wind_speed_unit: 'mph',
    // Unix times are unambiguous, whatever time zone the viewer is in.
    timeformat: 'unixtime',
    timezone: 'auto',
    forecast_days: '2',
  })

const HOURS_TO_FORECAST = 12

/** The name of the place the forecast is for, such as "Bristol". */
export const FORECAST_LOCATION_NAME = LOCATION.name

/** The forecast could not be fetched, because Open-Meteo or the network is down. */
export class WeatherUnavailableError extends Error {}

/** The parts of Open-Meteo's response that are used. Times are in seconds since the Unix epoch. */
interface OpenMeteoResponse {
  current: { time: number; temperature_2m: number; weather_code: number; is_day: number; wind_speed_10m: number }
  hourly: {
    time: number[]
    temperature_2m: number[]
    precipitation_probability: number[]
    weather_code: number[]
    is_day: number[]
    wind_speed_10m: number[]
  }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    sunrise: number[]
    sunset: number[]
  }
}

/**
 * Fetches the weather now, today's outlook, and the next twelve hours, for the forecast location.
 *
 * @returns The forecast.
 * @throws WeatherUnavailableError If the forecast can't be fetched.
 */
export async function fetchForecast(): Promise<Forecast> {
  let response: Response
  try {
    response = await fetch(FORECAST_URL)
  } catch (error) {
    // Callers can't do anything different for a network failure than for a server failure, so both become one error.
    throw new WeatherUnavailableError('Open-Meteo could not be reached.', { cause: error })
  }
  if (!response.ok) {
    throw new WeatherUnavailableError(`Open-Meteo answered with status ${response.status}.`)
  }
  return parseForecast(await response.json())
}

function parseForecast({ current, hourly, daily }: OpenMeteoResponse): Forecast {
  // The hourly forecast starts at midnight, so the current hour is the last one that has already started.
  const currentHourIndex = Math.max(0, hourly.time.findLastIndex((hourStart) => hourStart <= current.time))
  const hourIndexes = Array.from({ length: HOURS_TO_FORECAST }, (_, offset) => currentHourIndex + offset).filter(
    (index) => index < hourly.time.length,
  )

  return {
    current: {
      time: fromUnixTime(current.time),
      temperature: current.temperature_2m,
      condition: describeWeatherCode(current.weather_code),
      isDaytime: current.is_day === 1,
      windSpeed: current.wind_speed_10m,
    },
    // The daily forecast starts with today in the location's time zone.
    today: {
      high: daily.temperature_2m_max[0],
      low: daily.temperature_2m_min[0],
      sunrise: fromUnixTime(daily.sunrise[0]),
      sunset: fromUnixTime(daily.sunset[0]),
    },
    hours: hourIndexes.map((index) => ({
      time: fromUnixTime(hourly.time[index]),
      temperature: hourly.temperature_2m[index],
      rainChance: hourly.precipitation_probability[index],
      condition: describeWeatherCode(hourly.weather_code[index]),
      isDaytime: hourly.is_day[index] === 1,
      windSpeed: hourly.wind_speed_10m[index],
    })),
  }
}

function fromUnixTime(seconds: number): Date {
  return new Date(seconds * 1000)
}

// WMO weather interpretation codes, as Open-Meteo documents them.
const WEATHER_CODES: Record<number, [WeatherKind, string]> = {
  0: ['clear', 'Clear sky'],
  1: ['clear', 'Mostly clear'],
  2: ['partlyCloudy', 'Partly cloudy'],
  3: ['cloudy', 'Overcast'],
  45: ['fog', 'Fog'],
  48: ['fog', 'Freezing fog'],
  51: ['drizzle', 'Light drizzle'],
  53: ['drizzle', 'Drizzle'],
  55: ['drizzle', 'Heavy drizzle'],
  56: ['drizzle', 'Freezing drizzle'],
  57: ['drizzle', 'Heavy freezing drizzle'],
  61: ['rain', 'Light rain'],
  63: ['rain', 'Rain'],
  65: ['rain', 'Heavy rain'],
  66: ['rain', 'Freezing rain'],
  67: ['rain', 'Heavy freezing rain'],
  71: ['snow', 'Light snow'],
  73: ['snow', 'Snow'],
  75: ['snow', 'Heavy snow'],
  77: ['snow', 'Snow grains'],
  80: ['rain', 'Light showers'],
  81: ['rain', 'Showers'],
  82: ['rain', 'Heavy showers'],
  85: ['snow', 'Snow showers'],
  86: ['snow', 'Heavy snow showers'],
  95: ['thunder', 'Thunderstorm'],
  96: ['thunder', 'Thunderstorm with hail'],
  99: ['thunder', 'Severe thunderstorm with hail'],
}

function describeWeatherCode(code: number): WeatherCondition {
  // An unknown code is most likely a new kind of cloud cover, and a wrong icon is better than no forecast at all.
  const [kind, label] = WEATHER_CODES[code] ?? ['cloudy', 'Cloudy']
  return { kind, label }
}
