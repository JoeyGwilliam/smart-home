import { describeSceneWeather, describeTimeOfDay } from '@/scene/describeScene'

const SUNRISE = new Date('2026-11-09T07:00:00Z')
const SUNSET = new Date('2026-11-09T16:00:00Z')

test('describes the time as sunrise when the sun is about to rise', () => {
  const timeOfDay = describeTimeOfDay(new Date('2026-11-09T06:30:00Z'), SUNRISE, SUNSET)

  expect(timeOfDay).toBe('sunrise')
})

test('describes the time as sunrise when the sun has just risen', () => {
  const timeOfDay = describeTimeOfDay(new Date('2026-11-09T07:30:00Z'), SUNRISE, SUNSET)

  expect(timeOfDay).toBe('sunrise')
})

test('describes the time as day when the sun is well up', () => {
  const timeOfDay = describeTimeOfDay(new Date('2026-11-09T12:00:00Z'), SUNRISE, SUNSET)

  expect(timeOfDay).toBe('day')
})

test('describes the time as sunset when the sun is about to set', () => {
  const timeOfDay = describeTimeOfDay(new Date('2026-11-09T15:30:00Z'), SUNRISE, SUNSET)

  expect(timeOfDay).toBe('sunset')
})

test('describes the time as night when the sun set long ago', () => {
  const timeOfDay = describeTimeOfDay(new Date('2026-11-09T22:00:00Z'), SUNRISE, SUNSET)

  expect(timeOfDay).toBe('night')
})

test('describes the time as night when the sun is a long way from rising', () => {
  const timeOfDay = describeTimeOfDay(new Date('2026-11-09T03:00:00Z'), SUNRISE, SUNSET)

  expect(timeOfDay).toBe('night')
})

test('shows drizzle when the forecast is for drizzle', () => {
  const weather = describeSceneWeather('drizzle')

  expect(weather).toBe('drizzle')
})

test('shows a clear sky when the forecast is partly cloudy', () => {
  const weather = describeSceneWeather('partlyCloudy')

  expect(weather).toBe('clear')
})

test('shows snow when the forecast is for snow', () => {
  const weather = describeSceneWeather('snow')

  expect(weather).toBe('snow')
})
