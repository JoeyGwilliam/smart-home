import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PictureEditor } from '@/pages/pixelArt/PictureEditor'

const MIDDAY_SUN_ROWS = ['..oooo..', '.oooooo.', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', '.oooooo.', '..oooo..']

/** Answers listing the pictures with the given ones, and every change with success. */
function stubApi(picturesJson: object) {
  const fetch = vi.fn().mockImplementation((_url: string, request?: RequestInit) => {
    if (!request?.method || request.method === 'GET') return Promise.resolve(Response.json(picturesJson))
    if (request.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
    return Promise.resolve(Response.json(JSON.parse(request.body as string)))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** Shows the editor, working on the sun, whose first variant is an 8 by 8 picture of the midday sun. */
async function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PictureEditor />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /^Sun/ }))
  return user
}

/** Presses the drawing area at a pixel, as if the area were 10 screen pixels across for each of the drawing's pixels. */
function pressPixel(x: number, y: number) {
  const drawingArea = screen.getByRole('img', { name: /Drawing area/ })
  drawingArea.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 80 }) as DOMRect
  fireEvent.pointerDown(drawingArea, { clientX: x * 10 + 5, clientY: y * 10 + 5, pointerId: 1 })
  fireEvent.pointerUp(drawingArea, { pointerId: 1 })
}

function findSaved(fetch: ReturnType<typeof stubApi>) {
  const [url, request] = fetch.mock.calls.find(([, request]) => request?.method === 'PUT')!
  return { url, picture: JSON.parse(request.body) }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the sun as the site draws it, with nothing to save, when nothing has been redrawn', async () => {
  stubApi({})

  await renderPage()

  expect(screen.getByRole('heading', { name: 'Sun' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Drawing area, 8 by 8 pixels' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Show on the site' })).toBeDisabled()
})

test('offers each of the picture variants to draw', async () => {
  stubApi({})

  await renderPage()

  const variants = within(screen.getByRole('group', { name: 'Choose a variant' }))
  expect(variants.getByRole('button', { name: 'Midday' })).toHaveAttribute('aria-pressed', 'true')
  expect(variants.getByRole('button', { name: 'Low' })).toBeInTheDocument()
})

test('saves every variant, with the painted pixel in the chosen one, when the picture is shown on the site', async () => {
  const fetch = stubApi({})
  const user = await renderPage()

  pressPixel(0, 0)
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { url, picture } = findSaved(fetch)
  expect(url).toBe('/api/pixel-art/pictures/sun')
  expect(picture.variants.map((variant: { name: string }) => variant.name)).toEqual(['Midday', 'Low'])
  expect(picture.variants[0].frames[0].rows[0]).toBe('o.oooo..')
  expect(await screen.findByText('Done. Every screen now shows your drawing.')).toBeInTheDocument()
})

test('draws on the chosen variant when another variant is chosen', async () => {
  const fetch = stubApi({})
  const user = await renderPage()

  await user.click(within(screen.getByRole('group', { name: 'Choose a variant' })).getByRole('button', { name: 'Low' }))
  pressPixel(0, 0)
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { picture } = findSaved(fetch)
  expect(picture.variants[0].frames[0].rows[0]).toBe('..oooo..')
  expect(picture.variants[1].frames[0].rows[0]).toBe('o.oooo..')
})

test('makes the variant animated, with the copy drawn on separately, when a frame is copied', async () => {
  const fetch = stubApi({})
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Copy this frame' }))
  pressPixel(0, 0)
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { picture } = findSaved(fetch)
  expect(picture.variants[0].frames.map((frame: { rows: string[] }) => frame.rows[0])).toEqual(['..oooo..', 'o.oooo..'])
})

test('slides the frame, with what leaves one edge coming back at the other, when sliding it', async () => {
  const fetch = stubApi({})
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Slide down' }))
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { picture } = findSaved(fetch)
  expect(picture.variants[0].frames[0].rows.slice(0, 2)).toEqual(['..oooo..', '..oooo..'])
})

test('adds a copy of the chosen variant under a new name when copying it into a new variant', async () => {
  const fetch = stubApi({})
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Copy into a new variant' }))
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  const { picture } = findSaved(fetch)
  expect(picture.variants.map((variant: { name: string }) => variant.name)).toEqual(['Midday', 'Midday 2', 'Low'])
  expect(picture.variants[1].frames[0].rows).toEqual(MIDDAY_SUN_ROWS)
})

test("deletes the saved picture when the site's own picture is put back", async () => {
  const fetch = stubApi({ sun: { variants: [{ name: 'Midday', palette: { o: '#ffd94a' }, frames: [{ rows: ['o'], milliseconds: 200 }] }], title: null } })
  const user = await renderPage()

  await user.click(await screen.findByRole('button', { name: "Put back the site's own picture" }))

  const [url] = fetch.mock.calls.find(([, request]) => request?.method === 'DELETE')!
  expect(url).toBe('/api/pixel-art/pictures/sun')
})

test('saves a copy under a new id, with a title, when making a new picture', async () => {
  const fetch = stubApi({})
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Make a new picture' }))

  const { url, picture } = findSaved(fetch)
  expect(url).toMatch(/^\/api\/pixel-art\/pictures\/custom-[0-9a-f]{8}$/)
  expect(picture.title).toBe('My picture')
  expect(picture.variants[0].frames[0].rows).toEqual(MIDDAY_SUN_ROWS)
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('My picture')
})

test('explains the problem and keeps the drawing when the pixel art service cannot be reached', async () => {
  const fetch = stubApi({})
  const user = await renderPage()
  fetch.mockRejectedValue(new TypeError('Failed to fetch'))

  pressPixel(0, 0)
  await user.click(screen.getByRole('button', { name: 'Show on the site' }))

  expect(await screen.findByText(/Couldn't reach the pixel art service/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Show on the site' })).toBeEnabled()
})
