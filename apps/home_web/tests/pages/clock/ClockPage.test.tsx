import { act, render, screen } from '@testing-library/react'

import { ClockPage } from '@/pages/clock/ClockPage'

afterEach(() => {
  vi.useRealTimers()
})

test('shows the time and the date when the page is opened', () => {
  vi.useFakeTimers({ now: new Date(2026, 10, 12, 9, 5, 30) })

  render(<ClockPage />)

  expect(screen.getByText('09:05')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Thursday 12 November 2026' })).toBeInTheDocument()
})

test('shows the new minute when the minute changes', () => {
  vi.useFakeTimers({ now: new Date(2026, 10, 12, 9, 5, 59) })
  render(<ClockPage />)

  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(screen.getByText('09:06')).toBeInTheDocument()
})
