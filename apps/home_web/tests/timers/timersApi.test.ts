import { ApiUnavailableError, RequestRefusedError } from '@/homeApi/homeApi'
import {
  createPreset,
  deletePreset,
  getActiveTimer,
  listPresets,
  saveActiveTimer,
  savePreset,
} from '@/timers/timersApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('converts presets from the API format when listing them', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
    {
      id: 'abc',
      plan: { name: 'School run', end_time: '08:35:00', faff_multiplier: 1.5, tasks: [{ id: 'breakfast', name: 'Breakfast', duration_minutes: 25 }] },
    },
  ])))

  const presets = await listPresets()

  expect(presets).toEqual([
    { id: 'abc', plan: { name: 'School run', endTime: '08:35', faffMultiplier: 1.5, tasks: [{ id: 'breakfast', name: 'Breakfast', minutes: 25 }] } },
  ])
})

test('posts the plan in the API format when creating a preset', async () => {
  const planJson = { name: 'School run', end_time: '08:35:00', faff_multiplier: 1.5, tasks: [{ id: 'breakfast', name: 'Breakfast', duration_minutes: 25 }] }
  const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'abc', plan: planJson }, { status: 201 }))
  vi.stubGlobal('fetch', fetch)

  await createPreset({ name: 'School run', endTime: '08:35', faffMultiplier: 1.5, tasks: [{ id: 'breakfast', name: 'Breakfast', minutes: 25 }] })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/timers/presets')
  expect(request.method).toBe('POST')
  expect(JSON.parse(request.body)).toEqual({
    plan: { name: 'School run', end_time: '08:35', faff_multiplier: 1.5, tasks: [{ id: 'breakfast', name: 'Breakfast', duration_minutes: 25 }] },
  })
})

test('puts the plan at the address of the preset when saving it', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)

  await savePreset({ id: 'abc', plan: { name: 'School run', endTime: '08:35', faffMultiplier: 1, tasks: [] } })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/timers/presets/abc')
  expect(request.method).toBe('PUT')
  expect(JSON.parse(request.body)).toEqual({ plan: { name: 'School run', end_time: '08:35', faff_multiplier: 1, tasks: [] } })
})

test("sends a delete to the preset's address when deleting it", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await deletePreset('abc')

  expect(fetch).toHaveBeenCalledWith('/api/timers/presets/abc', expect.objectContaining({ method: 'DELETE' }))
})

test('converts the active timer from the API format when it has been started', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({
    plan: { name: '', end_time: '17:00:00', faff_multiplier: 1, tasks: [{ id: 'shower', name: 'Shower', duration_minutes: 15 }] },
    started_at: '2026-11-11T16:00:00Z',
  }))
  vi.stubGlobal('fetch', fetch)

  const activeTimer = await getActiveTimer()

  expect(fetch).toHaveBeenCalledWith('/api/timers/active-timer', expect.objectContaining({ method: 'GET' }))
  expect(activeTimer).toEqual({
    plan: { name: '', endTime: '17:00', faffMultiplier: 1, tasks: [{ id: 'shower', name: 'Shower', minutes: 15 }] },
    startedAt: new Date('2026-11-11T16:00:00Z'),
  })
})

test('has no start time when the active timer from the API is stopped', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
    plan: { name: '', end_time: '17:00:00', faff_multiplier: 1, tasks: [] },
    started_at: null,
  })))

  const activeTimer = await getActiveTimer()

  expect(activeTimer.startedAt).toBeNull()
})

test('puts the active timer in the API format when saving it', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)

  await saveActiveTimer({
    plan: { name: '', endTime: '17:00', faffMultiplier: 1, tasks: [{ id: 'shower', name: 'Shower', minutes: 15 }] },
    startedAt: new Date('2026-11-11T16:00:00Z'),
  })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/timers/active-timer')
  expect(request.method).toBe('PUT')
  expect(JSON.parse(request.body)).toEqual({
    plan: { name: '', end_time: '17:00', faff_multiplier: 1, tasks: [{ id: 'shower', name: 'Shower', duration_minutes: 15 }] },
    started_at: '2026-11-11T16:00:00.000Z',
  })
})

test('throws RequestRefusedError when the API rejects the content', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 422 })))

  const creating = createPreset({ name: ' ', endTime: '08:35', faffMultiplier: 1, tasks: [] })

  await expect(creating).rejects.toBeInstanceOf(RequestRefusedError)
})

test('throws ApiUnavailableError when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  const listing = listPresets()

  await expect(listing).rejects.toBeInstanceOf(ApiUnavailableError)
})

test('throws ApiUnavailableError when the proxy reports the API is down', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))

  const fetching = getActiveTimer()

  await expect(fetching).rejects.toBeInstanceOf(ApiUnavailableError)
})
