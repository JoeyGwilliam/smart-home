import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RemindersPage } from '@/pages/reminders/RemindersPage'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RemindersPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows active and completed reminders when the API has both', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
    { id: '1', title: 'Water the plants', notes: null, due_at: null, completed_at: null },
    { id: '2', title: 'Book the dentist', notes: null, due_at: null, completed_at: '2026-11-09T10:00:00Z' },
  ])))

  renderPage()

  expect(await screen.findByText('Water the plants')).toBeInTheDocument()
  expect(screen.getByText('Book the dentist')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
})

test('shows the empty state when there is nothing to do', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])))

  renderPage()

  expect(await screen.findByText('Nothing to do')).toBeInTheDocument()
})

test('explains the problem when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  renderPage()

  expect(await screen.findByRole('heading', { name: "Can't reach your reminders" })).toBeInTheDocument()
})

test('sends the new reminder to the API when one is added', async () => {
  const fetch = vi.fn().mockImplementation((_url: string, request?: RequestInit) =>
    Promise.resolve(request?.method === 'POST'
      ? Response.json({ id: '1', title: 'Water the plants', notes: null, due_at: null, completed_at: null }, { status: 201 })
      : Response.json([])),
  )
  vi.stubGlobal('fetch', fetch)
  renderPage()

  await userEvent.type(await screen.findByLabelText('Title'), 'Water the plants')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))

  const postRequest = fetch.mock.calls.find(([, request]) => request?.method === 'POST')?.[1]
  expect(JSON.parse(postRequest.body)).toEqual({ title: 'Water the plants', notes: null, due_at: null, completed_at: null })
})
