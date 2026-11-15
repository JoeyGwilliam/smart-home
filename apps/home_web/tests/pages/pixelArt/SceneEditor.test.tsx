import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SceneEditor } from '@/pages/pixelArt/SceneEditor'
import { useSettings } from '@/settings/useSettings'

/** Answers listing with the given scenes, and every change with success. Anything else, such as the forecast, fails. */
function stubApi(scenes: object = {}) {
  const fetch = vi.fn().mockImplementation((url: string, request?: RequestInit) => {
    const method = request?.method ?? 'GET'
    if (method === 'GET' && url === '/api/pixel-art/scenes') return Promise.resolve(Response.json(scenes))
    if (method === 'GET' && (url === '/api/pixel-art/layers' || url === '/api/pixel-art/pictures')) return Promise.resolve(Response.json({}))
    if (method === 'PUT') return Promise.resolve(Response.json(JSON.parse(request!.body as string)))
    if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
    return Promise.resolve(new Response(null, { status: 503 }))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** Shows the editor, working on the given scene of its list, such as "Day, rain". */
async function renderEditorOn(sceneName: string, onEditLayer = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SceneEditor onEditLayer={onEditLayer} />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(within(screen.getByRole('navigation', { name: 'Scenes' })).getByRole('button', { name: new RegExp(`^${sceneName}`) }))
  return user
}

function findSaved(fetch: ReturnType<typeof stubApi>) {
  const [url, request] = fetch.mock.calls.find(([, request]) => request?.method === 'PUT')!
  return { url, scene: JSON.parse(request.body) }
}

function listLayerNames() {
  return within(within(screen.getByRole('region', { name: 'Layers' })).getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => item.firstChild?.textContent)
}

afterEach(() => {
  vi.unstubAllGlobals()
  // The settings are shared by everything on the page, and outlast each test, so a scene chosen in one is forgotten.
  const { result } = renderHook(() => useSettings())
  act(() => result.current[1]({ chosenSceneId: null }))
  localStorage.clear()
})

test("lists the scene's layers front first, with nothing to save, when nothing has been changed", async () => {
  stubApi()

  await renderEditorOn('Day, rain')

  expect(screen.getByRole('heading', { name: 'Day, rain' })).toBeInTheDocument()
  expect(listLayerNames()).toEqual(['Rain', 'Umbrellas', 'Animals by day', 'Puddles', 'Grass', 'Grey clouds', 'A few clouds', 'Sky'])
  expect(screen.getByRole('button', { name: 'Show on the site' })).toBeDisabled()
})

test('saves the scene without the layer when a layer is taken out', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('Day, rain')

  await user.click(screen.getByRole('button', { name: 'Take Umbrellas out' }))
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { url, scene } = findSaved(fetch)
  expect(url).toBe('/api/pixel-art/scenes/day-rain')
  expect(scene.layer_ids).not.toContain('umbrellas')
  expect(await screen.findByText('Done. Every screen now shows this scene as you built it.')).toBeInTheDocument()
})

test('saves the layer at the front of the scene when a layer is added', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('Day, clear')

  await user.selectOptions(screen.getByRole('combobox', { name: 'Add a layer at the front' }), 'Snowman')
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { scene } = findSaved(fetch)
  expect(scene.layer_ids.at(-1)).toBe('snowman')
})

test('swaps the layer with the one in front when bringing it forward', async () => {
  stubApi()
  const user = await renderEditorOn('Day, rain')

  await user.click(screen.getByRole('button', { name: 'Bring Umbrellas forward' }))

  expect(listLayerNames().slice(0, 2)).toEqual(['Umbrellas', 'Rain'])
})

test('opens the layer on the Layers tab when its edit button is pressed', async () => {
  stubApi()
  const onEditLayer = vi.fn()
  const user = await renderEditorOn('Day, rain', onEditLayer)

  await user.click(screen.getByRole('button', { name: 'Edit Umbrellas' }))

  expect(onEditLayer).toHaveBeenCalledWith('umbrellas')
})

test('saves a copy under a new id when making a new scene', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('Day, clear')

  await user.click(screen.getByRole('button', { name: 'Make a new scene' }))

  const { url, scene } = findSaved(fetch)
  expect(url).toMatch(/^\/api\/pixel-art\/scenes\/custom-[0-9a-f]{8}$/)
  expect(scene.name).toBe('My scene')
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('My scene')
})

test("forgets the saved scene when the site's own scene is put back", async () => {
  const fetch = stubApi({ 'day-clear': { name: 'Day, clear', time_of_day: 'day', weather: 'clear', layer_ids: ['sky'] } })
  const user = await renderEditorOn('Day, clear')

  await user.click(await screen.findByRole('button', { name: "Put back the site's own scene" }))

  const [url] = fetch.mock.calls.find(([, request]) => request?.method === 'DELETE')!
  expect(url).toBe('/api/pixel-art/scenes/day-clear')
})

test("says which scene is behind this screen, and that it follows the time and weather, when none has been chosen", async () => {
  stubApi()

  await renderEditorOn('Night, drizzle')

  expect(screen.getByRole('status')).toHaveTextContent(/following the time of day and weather/)
})

test("shows one of the site's own scenes behind this screen when it is chosen for it", async () => {
  stubApi()
  const user = await renderEditorOn('Night, drizzle')

  await user.click(screen.getByRole('button', { name: 'Show behind this screen' }))

  expect(screen.getByRole('status')).toHaveTextContent('Behind this screen now: Night, drizzle, chosen for this screen.')
  expect(JSON.parse(localStorage.getItem('kiosk-viewer-settings')!).chosenSceneId).toBe('night-drizzle')
})

test('follows the time and weather again when asked to, after a scene was chosen for this screen', async () => {
  stubApi()
  const user = await renderEditorOn('Night, drizzle')
  await user.click(screen.getByRole('button', { name: 'Show behind this screen' }))

  await user.click(screen.getByRole('button', { name: 'Follow the time and weather again' }))

  expect(screen.getByRole('status')).toHaveTextContent(/following the time of day and weather/)
})
