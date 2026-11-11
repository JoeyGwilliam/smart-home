import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useReminderActions, useReminders } from '@/reminders/useReminders'

const UNTICKED_REMINDER_JSON = { id: 'abc', title: 'Water the plants', notes: null, due_at: null, completed_at: null, repeats: null }

/** Answers every list request with the reminder unticked, and holds every save until `finishSave` is called. */
function stubApiWithSlowSave() {
  let finishSave = () => {}
  const saveFinished = new Promise<void>((resolve) => (finishSave = resolve))
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, request?: RequestInit) => {
    if (request?.method === 'PUT') return saveFinished.then(() => Response.json({}))
    return Promise.resolve(Response.json([UNTICKED_REMINDER_JSON]))
  }))
  return { finishSave }
}

async function renderReminderHooks() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => ({ query: useReminders(), actions: useReminderActions() }), { wrapper })
  await waitFor(() => expect(result.current.query.data).toBeDefined())
  return result
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('keeps showing a change when a refresh arrives before the change reaches the API', async () => {
  stubApiWithSlowSave()
  const hooks = await renderReminderHooks()
  const tickedReminder = { ...hooks.current.query.data![0], completedAt: new Date('2026-11-09T10:00:00Z') }

  act(() => void hooks.current.actions.saveReminder(tickedReminder))
  await act(() => vi.advanceTimersByTimeAsync(2500))

  expect(hooks.current.query.data![0].completedAt).toEqual(new Date('2026-11-09T10:00:00Z'))
})

test('shows what the API holds when a refresh arrives after the change has settled', async () => {
  const api = stubApiWithSlowSave()
  const hooks = await renderReminderHooks()
  const tickedReminder = { ...hooks.current.query.data![0], completedAt: new Date('2026-11-09T10:00:00Z') }

  act(() => void hooks.current.actions.saveReminder(tickedReminder))
  await act(async () => api.finishSave())
  await act(() => vi.advanceTimersByTimeAsync(2500))

  expect(hooks.current.query.data![0].completedAt).toBeNull()
})
