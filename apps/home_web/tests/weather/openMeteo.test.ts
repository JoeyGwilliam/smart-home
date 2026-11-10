import { fetchForecast, WeatherUnavailableError } from '@/weather/openMeteo'

afterEach(() => {
  vi.unstubAllGlobals()
})

// 2026-11-09T00:00:00Z, the start of the hourly forecast.
const MIDNIGHT = 1794182400
const HOUR = 3600

function createOpenMeteoResponse(currentTime: number, hourCount: number) {
  const hours = Array.from({ length: hourCount }, (_, hour) => hour)
  return {
    current: { time: currentTime, temperature_2m: 7.2, weather_code: 3, is_day: 0 },
    hourly: {
      time: hours.map((hour) => MIDNIGHT + hour * HOUR),
      temperature_2m: hours.map((hour) => hour),
      precipitation_probability: hours.map(() => 20),
      weather_code: hours.map(() => 61),
      is_day: hours.map(() => 1),
    },
    daily: {
      temperature_2m_max: [8.4],
      temperature_2m_min: [3.7],
      sunrise: [MIDNIGHT + 7 * HOUR],
      sunset: [MIDNIGHT + 16 * HOUR],
    },
  }
}

test('describes the current weather when Open-Meteo answers', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(createOpenMeteoResponse(MIDNIGHT + 22 * HOUR + 900, 48))))

  const forecast = await fetchForecast()

  expect(forecast.current).toEqual({
    time: new Date('2026-11-09T22:15:00Z'),
    temperature: 7.2,
    condition: { kind: 'cloudy', label: 'Overcast' },
    isDaytime: false,
  })
})

test("describes today's outlook from the first day of the daily forecast", async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(createOpenMeteoResponse(MIDNIGHT, 48))))

  const forecast = await fetchForecast()

  expect(forecast.today).toEqual({
    high: 8.4,
    low: 3.7,
    sunrise: new Date('2026-11-09T07:00:00Z'),
    sunset: new Date('2026-11-09T16:00:00Z'),
  })
})

test('starts the hourly forecast at the current hour when partway through it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(createOpenMeteoResponse(MIDNIGHT + 22 * HOUR + 900, 48))))

  const forecast = await fetchForecast()

  expect(forecast.hours[0].time).toEqual(new Date('2026-11-09T22:00:00Z'))
  expect(forecast.hours).toHaveLength(12)
})

test('describes each hour when the hourly forecast is given', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(createOpenMeteoResponse(MIDNIGHT, 48))))

  const forecast = await fetchForecast()

  expect(forecast.hours[1]).toEqual({
    time: new Date('2026-11-09T01:00:00Z'),
    temperature: 1,
    rainChance: 20,
    condition: { kind: 'rain', label: 'Light rain' },
    isDaytime: true,
  })
})

test('gives fewer hours when the forecast ends sooner than twelve hours away', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(createOpenMeteoResponse(MIDNIGHT + 20 * HOUR, 24))))

  const forecast = await fetchForecast()

  expect(forecast.hours).toHaveLength(4)
})

test('describes an unknown weather code as cloudy when Open-Meteo adds a new one', async () => {
  const response = createOpenMeteoResponse(MIDNIGHT, 48)
  response.current.weather_code = 1234
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))

  const forecast = await fetchForecast()

  expect(forecast.current.condition).toEqual({ kind: 'cloudy', label: 'Cloudy' })
})

test('throws WeatherUnavailableError when Open-Meteo cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  const fetching = fetchForecast()

  await expect(fetching).rejects.toBeInstanceOf(WeatherUnavailableError)
})

test('throws WeatherUnavailableError when Open-Meteo answers with an error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))

  const fetching = fetchForecast()

  await expect(fetching).rejects.toBeInstanceOf(WeatherUnavailableError)
})
