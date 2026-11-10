import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DashboardPage } from '@/pages/dashboard/DashboardPage'

const MIDNIGHT = 1794182400
const HOUR = 3600

const FORECAST = {
  current: { time: MIDNIGHT + 10 * HOUR, temperature_2m: 7.2, weather_code: 3, is_day: 1, wind_speed_10m: 7.8 },
  hourly: {
    time: Array.from({ length: 24 }, (_, hour) => MIDNIGHT + hour * HOUR),
    temperature_2m: Array.from({ length: 24 }, () => 8),
    precipitation_probability: Array.from({ length: 24 }, () => 30),
    weather_code: Array.from({ length: 24 }, () => 61),
    is_day: Array.from({ length: 24 }, () => 1),
    wind_speed_10m: Array.from({ length: 24 }, () => 6),
  },
  daily: {
    temperature_2m_max: [8.4],
    temperature_2m_min: [3.7],
    sunrise: [MIDNIGHT + 7 * HOUR],
    sunset: [MIDNIGHT + 16 * HOUR],
  },
}

function stubFetch(reminders: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
    Promise.resolve(Response.json(url.startsWith('https://api.open-meteo.com') ? FORECAST : reminders)),
  ))
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-09T10:00:00Z'), shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('shows only the reminders due today when others are due later', async () => {
  stubFetch([
    { id: '1', title: 'Water the plants', notes: null, due_at: '2026-11-09T18:00:00Z', completed_at: null },
    { id: '2', title: 'Book the dentist', notes: null, due_at: '2026-11-12T09:00:00Z', completed_at: null },
  ])

  renderPage()

  expect(await screen.findByText('Water the plants')).toBeInTheDocument()
  expect(screen.queryByText('Book the dentist')).not.toBeInTheDocument()
})

test('offers no way to delete a reminder when it is shown on the dashboard', async () => {
  stubFetch([{ id: '1', title: 'Water the plants', notes: null, due_at: '2026-11-09T18:00:00Z', completed_at: null }])

  renderPage()

  expect(await screen.findByRole('button', { name: 'Edit Water the plants' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete Water the plants' })).not.toBeInTheDocument()
})

test('shows the current weather when the forecast loads', async () => {
  stubFetch([])

  renderPage()

  const weather = await screen.findByRole('region', { name: 'Weather in Bristol' })
  expect(within(weather).getByText('Overcast')).toBeInTheDocument()
})

test('hides the chance of rain when the weather has not been tapped', async () => {
  stubFetch([])

  renderPage()

  const weather = await screen.findByRole('region', { name: 'Weather in Bristol' })
  expect(within(weather).queryByLabelText('30% chance of rain')).not.toBeInTheDocument()
})

test("shows today's high and low temperatures when the weather is tapped", async () => {
  stubFetch([])
  renderPage()
  const weather = await screen.findByRole('region', { name: 'Weather in Bristol' })

  await userEvent.click(within(weather).getByRole('button', { expanded: false }))

  expect(within(weather).getByText('H 8°')).toBeInTheDocument()
  expect(within(weather).getByText('L 4°')).toBeInTheDocument()
})

test('opens the hour-by-hour forecast when the weather is tapped', async () => {
  stubFetch([])
  renderPage()
  const weather = await screen.findByRole('region', { name: 'Weather in Bristol' })

  await userEvent.click(within(weather).getByRole('button', { expanded: false }))

  expect(within(weather).getByRole('button', { expanded: true })).toBeInTheDocument()
  expect(within(within(weather).getByRole('list')).getAllByLabelText('30% chance of rain')).toHaveLength(12)
})

test('shows the sunrise and sunset times when the weather is tapped', async () => {
  stubFetch([])
  renderPage()
  const weather = await screen.findByRole('region', { name: 'Weather in Bristol' })

  await userEvent.click(within(weather).getByRole('button', { expanded: false }))

  expect(within(weather).getByLabelText('Sunrise at 07:00')).toBeInTheDocument()
  expect(within(weather).getByLabelText('Sunset at 16:00')).toBeInTheDocument()
})

test('hides the notes of a reminder when it has not been tapped', async () => {
  stubFetch([{ id: '1', title: 'Water the plants', notes: 'Not the cactus', due_at: '2026-11-09T18:00:00Z', completed_at: null }])

  renderPage()

  expect(await screen.findByRole('button', { name: 'Water the plants' })).toBeInTheDocument()
  expect(screen.queryByText('Not the cactus')).not.toBeInTheDocument()
})

test('shows the notes of a reminder when it is tapped', async () => {
  stubFetch([{ id: '1', title: 'Water the plants', notes: 'Not the cactus', due_at: '2026-11-09T18:00:00Z', completed_at: null }])
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Water the plants' }))

  expect(screen.getByText('Not the cactus')).toBeInTheDocument()
})
