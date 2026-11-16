import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { LayerEditor } from '@/pages/pixelArt/LayerEditor'

/** Answers listing with the given layers, and every change with success. Anything else, such as the forecast, fails. */
function stubApi(layers: object = {}) {
  const fetch = vi.fn().mockImplementation((url: string, request?: RequestInit) => {
    const method = request?.method ?? 'GET'
    if (method === 'GET' && url === '/api/pixel-art/layers') return Promise.resolve(Response.json(layers))
    if (method === 'GET' && (url === '/api/pixel-art/scenes' || url === '/api/pixel-art/pictures')) return Promise.resolve(Response.json({}))
    if (method === 'PUT') return Promise.resolve(Response.json(JSON.parse(request!.body as string)))
    if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
    return Promise.resolve(new Response(null, { status: 503 }))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function LayerEditorStartingOn({ layerId }: { layerId: string }) {
  const [chosenLayerId, setChosenLayerId] = useState(layerId)
  return <LayerEditor chosenLayerId={chosenLayerId} onChooseLayer={setChosenLayerId} />
}

/** Shows the editor, working on the given layer, shown in the rainy day scene. */
async function renderEditorOn(layerId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <LayerEditorStartingOn layerId={layerId} />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Show it in the scene' }), 'Day, rain')
  return user
}

function pressPlacement(placementId: string) {
  const preview = screen.getByRole('img', { name: 'Preview' })
  fireEvent.pointerDown(preview.querySelector(`[data-placement-id="${placementId}"]`)!, { clientX: 100, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(preview, { pointerId: 1 })
}

function findSaved(fetch: ReturnType<typeof stubApi>) {
  const [url, request] = fetch.mock.calls.find(([, request]) => request?.method === 'PUT')!
  return { url, layer: JSON.parse(request.body) }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test("lets only the layer's own pictures be pressed, however much the other layers cover", async () => {
  stubApi()

  await renderEditorOn('umbrellas')

  const preview = screen.getByRole('img', { name: 'Preview' })
  expect(preview.querySelector('[data-placement-id="umbrella-cow"]')).not.toBeNull()
  expect(preview.querySelector('[data-placement-id="rain"]')).toBeNull()
  expect(preview.querySelector('[data-placement-id="cow"]')).toBeNull()
})

test('moves the picture across by as far as it is dragged, counted against the width of a portrait screen to begin with', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('umbrellas')
  const preview = screen.getByRole('img', { name: 'Preview' })

  // The preview starts at half size, so 36 screen pixels across it is 72 across the 720-pixel screen it shows: 10%.
  fireEvent.pointerDown(preview.querySelector('[data-placement-id="umbrella-cow"]')!, { clientX: 100, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(preview, { clientX: 136, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(preview, { pointerId: 1 })
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { url, layer } = findSaved(fetch)
  expect(url).toBe('/api/pixel-art/layers/umbrellas')
  expect(layer.placements.find((placement: { id: string }) => placement.id === 'umbrella-cow').x).toBe(20)
})

test('moves the picture across by as far as it is dragged, counted against the width of a landscape screen when that is chosen', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('umbrellas')
  await user.click(screen.getByRole('button', { name: 'landscape' }))
  const preview = screen.getByRole('img', { name: 'Preview' })

  // The preview starts at half size, so 32 screen pixels across it is 64 across the 1280-pixel screen it shows: 5%.
  fireEvent.pointerDown(preview.querySelector('[data-placement-id="umbrella-cow"]')!, { clientX: 100, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(preview, { clientX: 132, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(preview, { pointerId: 1 })
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { layer } = findSaved(fetch)
  expect(layer.placements.find((placement: { id: string }) => placement.id === 'umbrella-cow').x).toBe(15)
})

test('starts the preview in portrait', async () => {
  stubApi()

  await renderEditorOn('umbrellas')

  expect(screen.getByRole('button', { name: 'portrait' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'landscape' })).toHaveAttribute('aria-pressed', 'false')
})

test('saves the added picture for every scene with the layer when a picture is added', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('umbrellas')

  await user.selectOptions(screen.getByRole('combobox', { name: 'Add a picture at the front' }), 'Snowman')
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { layer } = findSaved(fetch)
  expect(layer.placements.at(-1)).toMatchObject({ id: 'snowman-1', picture_id: 'snowman', anchor: 'bottom' })
  expect(await screen.findByText('Done. Every scene with this layer now shows it as you arranged it.')).toBeInTheDocument()
})

test('swaps the variant of the selected picture when another is chosen', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('umbrellas')
  pressPlacement('umbrella-cow')

  await user.selectOptions(within(screen.getByRole('region', { name: 'Selected picture' })).getByRole('combobox', { name: 'Variant' }), 'Yellow')
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { layer } = findSaved(fetch)
  expect(layer.placements.find((placement: { id: string }) => placement.id === 'umbrella-cow').variant).toBe('Yellow')
})

test('shows the layer on its own when no scene is chosen to show it in', async () => {
  stubApi()
  const user = await renderEditorOn('umbrellas')

  await user.selectOptions(screen.getByRole('combobox', { name: 'Show it in the scene' }), 'None: just this layer')

  // Each of the four umbrellas is drawn as one picture, and nothing else is drawn.
  const preview = screen.getByRole('img', { name: 'Preview' })
  expect(preview.querySelectorAll('svg')).toHaveLength(4)
})

function listPictureNames() {
  return within(within(screen.getByRole('region', { name: 'Pictures in this layer' })).getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => item.firstChild?.textContent)
}

test("lists the layer's pictures front first, named by their variant", async () => {
  stubApi()

  await renderEditorOn('umbrellas')

  expect(listPictureNames()).toEqual(['Umbrella, Yellow', 'Umbrella, Purple', 'Umbrella, Blue', 'Umbrella, Red'])
})

test('numbers pictures in the list that would otherwise share a name', async () => {
  stubApi()

  await renderEditorOn('puddles')

  expect(listPictureNames()).toEqual(['Puddle 4', 'Puddle 3', 'Puddle 2', 'Puddle 1'])
})

test('opens the picture to change when its edit button in the list is pressed', async () => {
  stubApi()
  const user = await renderEditorOn('umbrellas')

  await user.click(screen.getByRole('button', { name: 'Edit Umbrella, Blue' }))

  expect(within(screen.getByRole('region', { name: 'Selected picture' })).getByRole('combobox', { name: 'Variant' })).toHaveValue('Blue')
})

test('saves the layer without the picture when it is taken out of the list', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('umbrellas')

  await user.click(screen.getByRole('button', { name: 'Take Umbrella, Red out' }))
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { layer } = findSaved(fetch)
  expect(layer.placements.map((placement: { id: string }) => placement.id)).not.toContain('umbrella-cow')
})

test('swaps the picture with the one in front when bringing it forward in the list', async () => {
  stubApi()
  const user = await renderEditorOn('umbrellas')

  await user.click(screen.getByRole('button', { name: 'Bring Umbrella, Purple forward' }))

  expect(listPictureNames().slice(0, 2)).toEqual(['Umbrella, Purple', 'Umbrella, Yellow'])
})

test('saves an empty layer under a new id when making a new layer', async () => {
  const fetch = stubApi()
  const user = await renderEditorOn('umbrellas')

  await user.click(screen.getByRole('button', { name: 'Make a new layer' }))

  const { url, layer } = findSaved(fetch)
  expect(url).toMatch(/^\/api\/pixel-art\/layers\/custom-[0-9a-f]{8}$/)
  expect(layer).toEqual({ name: 'My layer', placements: [] })
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('My layer')
})

test("forgets the saved layer when the site's own layer is put back", async () => {
  const fetch = stubApi({ umbrellas: { name: 'Umbrellas', placements: [] } })
  const user = await renderEditorOn('umbrellas')

  await user.click(await screen.findByRole('button', { name: "Put back the site's own layer" }))

  const [url] = fetch.mock.calls.find(([, request]) => request?.method === 'DELETE')!
  expect(url).toBe('/api/pixel-art/layers/umbrellas')
})
