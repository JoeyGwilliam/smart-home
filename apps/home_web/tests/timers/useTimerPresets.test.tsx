import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useTimerPresetActions, useTimerPresets } from '@/timers/useTimerPresets'

const SCHOOL_RUN_JSON = { id: 'abc', plan: { name: 'School run', end_time: '08:35:00', faff_multiplier: 1, tasks: [] } }

/** Answers every list request with the "School run" preset, and every change with the given response. */
function stubApi(answerChange: () => Response) {
  const fetch = vi.fn().mockImplementation((_url: string, request?: RequestInit) =>
    Promise.resolve(request?.method === 'GET' ? Response.json([SCHOOL_RUN_JSON]) : answerChange()),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function renderPresetHooks() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => ({ query: useTimerPresets(), actions: useTimerPresetActions() }), { wrapper })
  await waitFor(() => expect(result.current.query.data).toBeDefined())
  return result
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('creates a preset when no preset has the name of the plan', async () => {
  const fetch = stubApi(() => Response.json({ id: 'def', plan: { ...SCHOOL_RUN_JSON.plan, name: 'Night out' } }, { status: 201 }))
  const hooks = await renderPresetHooks()

  const outcome = await act(() => hooks.current.actions.savePlanAsPreset({ name: 'Night out', endTime: '19:00', faffMultiplier: 1, tasks: [] }))

  expect(outcome).toBe('saved')
  expect(fetch).toHaveBeenCalledWith('/api/timers/presets', expect.objectContaining({ method: 'POST' }))
})

test('replaces the preset when one has the name of the plan in different capitals', async () => {
  const fetch = stubApi(() => Response.json({}))
  const hooks = await renderPresetHooks()

  const outcome = await act(() => hooks.current.actions.savePlanAsPreset({ name: ' school RUN ', endTime: '08:50', faffMultiplier: 1, tasks: [] }))

  expect(outcome).toBe('saved')
  const putRequest = fetch.mock.calls.find(([, request]) => request?.method === 'PUT')
  expect(putRequest?.[0]).toBe('/api/timers/presets/abc')
  expect(JSON.parse(putRequest?.[1].body)).toEqual({ plan: { name: 'school RUN', end_time: '08:50', faff_multiplier: 1, tasks: [] } })
})

test('reports that the plan is invalid when the API rejects it', async () => {
  stubApi(() => new Response(null, { status: 422 }))
  const hooks = await renderPresetHooks()

  const outcome = await act(() => hooks.current.actions.savePlanAsPreset({ name: 'Night out', endTime: '19:00', faffMultiplier: 1, tasks: [] }))

  expect(outcome).toBe('invalid')
})

test('reports that the API is unavailable when a delete gets no answer from it', async () => {
  stubApi(() => new Response(null, { status: 502 }))
  const hooks = await renderPresetHooks()

  const outcome = await act(() => hooks.current.actions.deletePreset('abc'))

  expect(outcome).toBe('unavailable')
})
