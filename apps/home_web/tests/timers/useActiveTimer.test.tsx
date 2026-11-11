import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useActiveTimer } from '@/timers/useActiveTimer'

const STOPPED_TIMER_JSON = {
  plan: { name: 'School run', end_time: '08:35:00', faff_multiplier: 1, tasks: [{ id: 'shoes', name: 'Shoes on', duration_minutes: 5 }] },
  started_at: null,
}

/**
 * Stands in for the timers API, holding the active timer as another screen left it. Saves reach it straight away,
 * unless `holdSaves` is called first, after which each one waits for `finishSaves`.
 */
function stubApi() {
  const api = {
    activeTimerJson: STOPPED_TIMER_JSON as object,
    isDown: false,
    holdSaves: () => {
      saveGate = new Promise((resolve) => (api.finishSaves = resolve))
    },
    finishSaves: () => {},
  }
  let saveGate = Promise.resolve()

  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, request: RequestInit) => {
    if (api.isDown) return new Response(null, { status: 502 })
    if (request.method === 'PUT') {
      await saveGate
      api.activeTimerJson = JSON.parse(request.body as string)
    }
    return Response.json(api.activeTimerJson)
  }))
  return api
}

async function renderActiveTimer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useActiveTimer(), { wrapper })
  await waitFor(() => expect(result.current.timer).toBeDefined())
  return result
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-11T07:50:00Z'), shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('provides the timer that the API holds when it has been fetched', async () => {
  stubApi()

  const hook = await renderActiveTimer()

  expect(hook.current.timer).toEqual({
    plan: { name: 'School run', endTime: '08:35', faffMultiplier: 1, tasks: [{ id: 'shoes', name: 'Shoes on', minutes: 5 }] },
    startedAt: null,
  })
})

test('shows a change made on another screen when the next refresh arrives', async () => {
  const api = stubApi()
  const hook = await renderActiveTimer()

  api.activeTimerJson = { ...STOPPED_TIMER_JSON, started_at: '2026-11-11T07:49:00Z' }
  await act(() => vi.advanceTimersByTimeAsync(1500))

  expect(hook.current.timer?.startedAt).toEqual(new Date('2026-11-11T07:49:00Z'))
})

test('sends the current time to the API when the timer is started', async () => {
  const api = stubApi()
  const hook = await renderActiveTimer()

  act(() => hook.current.start())

  // The fake clock keeps running, so the start is within the second rather than exactly on it.
  await waitFor(() => expect(api.activeTimerJson).toMatchObject({ started_at: expect.stringMatching(/^2026-11-11T07:50:00/) }))
  expect(hook.current.timer?.startedAt?.toISOString()).toMatch(/^2026-11-11T07:50:00/)
})

test('sends a stopped timer to the API when a started timer is stopped', async () => {
  const api = stubApi()
  api.activeTimerJson = { ...STOPPED_TIMER_JSON, started_at: '2026-11-11T07:49:00Z' }
  const hook = await renderActiveTimer()

  act(() => hook.current.stop())

  await waitFor(() => expect(api.activeTimerJson).toMatchObject({ started_at: null }))
  expect(hook.current.timer?.startedAt).toBeNull()
})

test('shows a changed plan straight away when the API has not yet answered', async () => {
  const api = stubApi()
  const hook = await renderActiveTimer()
  api.holdSaves()
  const renamedPlan = { ...hook.current.timer!.plan, name: 'Nursery run' }

  act(() => hook.current.changePlan(renamedPlan))

  expect(hook.current.timer?.plan).toEqual(renamedPlan)
})

test('keeps showing a change when a refresh arrives before the change reaches the API', async () => {
  const api = stubApi()
  const hook = await renderActiveTimer()
  api.holdSaves()

  act(() => hook.current.changePlan({ ...hook.current.timer!.plan, name: 'Nursery run' }))
  await act(() => vi.advanceTimersByTimeAsync(2500))

  expect(hook.current.timer?.plan.name).toBe('Nursery run')
})

test('ends with the last of several quick changes when they have all reached the API', async () => {
  const api = stubApi()
  const hook = await renderActiveTimer()
  api.holdSaves()
  const plan = hook.current.timer!.plan

  act(() => hook.current.changePlan({ ...plan, name: 'N' }))
  act(() => hook.current.changePlan({ ...plan, name: 'Nu' }))
  act(() => hook.current.changePlan({ ...plan, name: 'Nur' }))
  await act(async () => api.finishSaves())
  await act(() => vi.advanceTimersByTimeAsync(2500))

  expect(api.activeTimerJson).toMatchObject({ plan: { name: 'Nur' } })
  expect(hook.current.timer?.plan.name).toBe('Nur')
})

test('goes back to the timer that the API holds when a change cannot reach it', async () => {
  const api = stubApi()
  const hook = await renderActiveTimer()
  api.isDown = true

  act(() => hook.current.changePlan({ ...hook.current.timer!.plan, name: 'Nursery run' }))

  await waitFor(() => expect(hook.current.timer?.plan.name).toBe('School run'))
})

test('reports that the API is unavailable when the timer cannot be fetched', async () => {
  const api = stubApi()
  api.isDown = true
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

  const { result } = renderHook(() => useActiveTimer(), { wrapper })

  await waitFor(() => expect(result.current.isUnavailable).toBe(true))
  expect(result.current.timer).toBeUndefined()
})
