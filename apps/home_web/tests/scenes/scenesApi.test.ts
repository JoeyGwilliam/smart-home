import {
  applyPreset,
  deleteLayer,
  deleteScene,
  listLayers,
  listPresets,
  listScenes,
  overwritePreset,
  renamePreset,
  savePreset,
  saveLayer,
  saveScene,
} from '@/scenes/scenesApi'
import type { LayerDesign, SceneDesign } from '@/scenes/sceneDesign'

const PLACEMENT_JSON = {
  id: 'umbrella-cow',
  picture_id: 'umbrella',
  variant: 'Blue',
  x: 10,
  anchor: 'bottom',
  y: 56,
  pixel_size: 4,
  spread: 'none',
  opacity: 80,
  is_flipped: true,
  motion: 'none',
}

const PLACEMENT = {
  id: 'umbrella-cow',
  pictureId: 'umbrella',
  variant: 'Blue',
  x: 10,
  anchor: 'bottom',
  y: 56,
  pixelSize: 4,
  spread: 'none',
  opacity: 80,
  isFlipped: true,
  motion: 'none',
} as const

afterEach(() => {
  vi.unstubAllGlobals()
})

test('converts each scene from the API format when listing scenes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ 'custom-christmas': { name: 'Christmas', time_of_day: 'night', weather: 'snow', layer_ids: ['sky', 'snow'] } })))

  const scenes = await listScenes()

  expect(scenes).toEqual({ 'custom-christmas': { name: 'Christmas', look: { timeOfDay: 'night', weather: 'snow' }, layerIds: ['sky', 'snow'] } })
})

test('puts the scene in the API format under its id when saving a scene', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)
  const scene: SceneDesign = { name: 'Christmas', look: { timeOfDay: 'night', weather: 'snow' }, layerIds: ['sky', 'snow'] }

  await saveScene('custom-christmas', scene)

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/scenes/custom-christmas')
  expect(request.method).toBe('PUT')
  expect(JSON.parse(request.body)).toEqual({ name: 'Christmas', time_of_day: 'night', weather: 'snow', layer_ids: ['sky', 'snow'] })
})

test('sends a delete to the scene when deleting it', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await deleteScene('day')

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/scenes/day')
  expect(request.method).toBe('DELETE')
})

test('converts each layer from the API format when listing layers', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ umbrellas: { name: 'Umbrellas', placements: [PLACEMENT_JSON] } })))

  const layers = await listLayers()

  expect(layers).toEqual({ umbrellas: { name: 'Umbrellas', placements: [PLACEMENT] } })
})

test('puts the layer in the API format under its id when saving a layer', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)
  const layer: LayerDesign = { name: 'Umbrellas', placements: [{ ...PLACEMENT }] }

  await saveLayer('umbrellas', layer)

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/layers/umbrellas')
  expect(JSON.parse(request.body)).toEqual({ name: 'Umbrellas', placements: [PLACEMENT_JSON] })
})

test('sends a delete to the layer when deleting it', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await deleteLayer('rain')

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/layers/rain')
  expect(request.method).toBe('DELETE')
})

test('converts each preset from the API format when listing presets', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([{ id: 'abc', name: 'Winter', saved_at: '2026-12-01T09:00:00Z' }])))

  const presets = await listPresets()

  expect(presets).toEqual([{ id: 'abc', name: 'Winter', savedAt: new Date('2026-12-01T09:00:00Z') }])
})

test('posts the name when saving a preset', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 201 }))
  vi.stubGlobal('fetch', fetch)

  await savePreset('Winter')

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/presets')
  expect(JSON.parse(request.body)).toEqual({ name: 'Winter' })
})

test('posts to the preset when applying it', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await applyPreset('winter-id')

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/presets/winter-id/apply')
  expect(request.method).toBe('POST')
})

test('posts to the preset when saving the current design into it', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await overwritePreset('winter-id')

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/presets/winter-id/overwrite')
  expect(request.method).toBe('POST')
})

test('patches the name when renaming a preset', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)

  await renamePreset('winter-id', 'Midwinter')

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/presets/winter-id')
  expect(request.method).toBe('PATCH')
  expect(JSON.parse(request.body)).toEqual({ name: 'Midwinter' })
})
