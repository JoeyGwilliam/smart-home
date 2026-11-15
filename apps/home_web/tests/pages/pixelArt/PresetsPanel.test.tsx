import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PresetsPanel } from '@/pages/pixelArt/PresetsPanel'

const SITE_PRESET_JSON = { id: 'site-id', name: "The site's own design", saved_at: '2026-11-15T00:00:00Z' }
const WINTER_JSON = { id: 'winter-id', name: 'Winter', saved_at: '2026-12-01T09:00:00Z' }

/** Answers listing the presets with the given ones, and every change with success. */
function stubApi(presetsJson: object[]) {
  const fetch = vi.fn().mockImplementation((url: string, request?: RequestInit) => {
    const method = request?.method ?? 'GET'
    if (method === 'GET' && url === '/api/pixel-art/presets') return Promise.resolve(Response.json(presetsJson))
    if (method === 'GET') return Promise.resolve(Response.json({}))
    if (method === 'POST' && url === '/api/pixel-art/presets') return Promise.resolve(Response.json(WINTER_JSON, { status: 201 }))
    if (method === 'PATCH') return Promise.resolve(Response.json(WINTER_JSON))
    return Promise.resolve(new Response(null, { status: 204 }))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PresetsPanel />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

function wasCalled(fetch: ReturnType<typeof stubApi>, method: string, url: string) {
  return fetch.mock.calls.some(([calledUrl, request]) => calledUrl === url && request?.method === method)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test("lists the site's own design among the presets, like any other", async () => {
  stubApi([SITE_PRESET_JSON, WINTER_JSON])

  renderPanel()

  expect(await screen.findByRole('textbox', { name: "Name of The site's own design" })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name of Winter' })).toBeInTheDocument()
})

test('saves the design under the name given when saving a new preset', async () => {
  const fetch = stubApi([])
  const user = renderPanel()

  await user.type(screen.getByRole('textbox', { name: 'Name for the design as it is now' }), 'Summer')
  await user.click(screen.getByRole('button', { name: 'Save as a new preset' }))

  const [, request] = fetch.mock.calls.find(([url, request]) => url === '/api/pixel-art/presets' && request?.method === 'POST')!
  expect(JSON.parse(request.body)).toEqual({ name: 'Summer' })
  expect(await screen.findByText('Saved "Summer". Put it back whenever you like.')).toBeInTheDocument()
})

test('applies the preset once it is confirmed when putting a preset back', async () => {
  const fetch = stubApi([SITE_PRESET_JSON])
  const user = renderPanel()

  await user.click(await screen.findByRole('button', { name: "Put The site's own design back" }))
  await user.click(screen.getByRole('button', { name: 'Put it back' }))

  expect(wasCalled(fetch, 'POST', '/api/pixel-art/presets/site-id/apply')).toBe(true)
})

test('changes nothing when putting a preset back is cancelled', async () => {
  const fetch = stubApi([WINTER_JSON])
  const user = renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Put Winter back' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/apply'))).toBe(false)
})

test("saves the current design into the site's own design once it is confirmed", async () => {
  const fetch = stubApi([SITE_PRESET_JSON])
  const user = renderPanel()

  await user.click(await screen.findByRole('button', { name: "Save the current design into The site's own design" }))
  await user.click(screen.getByRole('button', { name: 'Save into it' }))

  expect(wasCalled(fetch, 'POST', '/api/pixel-art/presets/site-id/overwrite')).toBe(true)
})

test('renames the preset when a new name is typed into it', async () => {
  const fetch = stubApi([WINTER_JSON])
  const user = renderPanel()
  const nameBox = await screen.findByRole('textbox', { name: 'Name of Winter' })

  await user.clear(nameBox)
  await user.type(nameBox, 'Midwinter{Enter}')

  const [, request] = fetch.mock.calls.find(([, request]) => request?.method === 'PATCH')!
  expect(JSON.parse(request.body)).toEqual({ name: 'Midwinter' })
})
