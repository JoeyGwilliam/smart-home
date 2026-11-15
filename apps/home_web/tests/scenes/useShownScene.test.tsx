import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useShownScene } from '@/scenes/useShownScene'

const CHANGED_NIGHT_DRIZZLE_JSON = { name: 'Night, drizzle', time_of_day: 'night', weather: 'drizzle', layer_ids: ['sky', 'snowman'] }

/** Answers listing the scenes with the given ones, and everything else, such as the forecast, with nothing useful. */
function stubApi(scenesJson: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => Promise.resolve(url === '/api/pixel-art/scenes' ? Response.json(scenesJson) : url.startsWith('/api/') ? Response.json({}) : new Response(null, { status: 503 }))),
  )
}

async function renderShownScene() {
  // The settings module reads storage once, when it is first imported, so each test imports a fresh copy.
  vi.resetModules()
  const { useShownScene: freshUseShownScene } = await import('@/scenes/useShownScene')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return renderHook(() => (freshUseShownScene as typeof useShownScene)(), { wrapper })
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

test('shows the scene as it was changed when the screen is set to its time of day and weather', async () => {
  localStorage.setItem('kiosk-viewer-settings', JSON.stringify({ sceneTime: 'night', sceneWeather: 'drizzle' }))
  stubApi({ 'night-drizzle': CHANGED_NIGHT_DRIZZLE_JSON })

  const { result } = await renderShownScene()

  await waitFor(() => expect(result.current.layers.map((layer) => layer.id)).toEqual(['sky', 'snowman']))
})

test("shows the site's own scene for the time of day and weather when it hasn't been changed", async () => {
  localStorage.setItem('kiosk-viewer-settings', JSON.stringify({ sceneTime: 'night', sceneWeather: 'drizzle' }))
  stubApi({})

  const { result } = await renderShownScene()

  await waitFor(() => expect(result.current.scene.name).toBe('Night, drizzle'))
  expect(result.current.layers.map((layer) => layer.id)).toContain('drizzle')
})
