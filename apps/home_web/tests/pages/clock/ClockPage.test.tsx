import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { ClockPage } from '@/pages/clock/ClockPage'

afterEach(() => {
  vi.useRealTimers()
})

/** Shows the clock page at "/clock", beside a dashboard at "/" that just says "Dashboard". */
async function renderClockPage() {
  const rootRoute = createRootRoute()
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/clock'] }),
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <p>Dashboard</p> }),
      createRoute({ getParentRoute: () => rootRoute, path: '/clock', component: ClockPage }),
    ]),
  })
  await act(() => router.load())
  render(<RouterProvider router={router} />)
}

test('shows the time and the date when the page is opened', async () => {
  vi.useFakeTimers({ now: new Date(2026, 10, 12, 9, 5, 30), shouldAdvanceTime: true })

  await renderClockPage()

  expect(await screen.findByText('09:05')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Thursday 12 November 2026' })).toBeInTheDocument()
})

test('shows the new minute when the minute changes', async () => {
  vi.useFakeTimers({ now: new Date(2026, 10, 12, 9, 5, 59), shouldAdvanceTime: true })
  await renderClockPage()
  await screen.findByText('09:05')

  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(screen.getByText('09:06')).toBeInTheDocument()
})

test('goes to the dashboard when the clock is clicked', async () => {
  await renderClockPage()

  fireEvent.click(await screen.findByRole('link', { name: 'Go to the dashboard' }))

  expect(await screen.findByText('Dashboard')).toBeInTheDocument()
})
