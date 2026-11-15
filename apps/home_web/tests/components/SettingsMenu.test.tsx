import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SettingsMenu } from '@/components/SettingsMenu'

/** Shows the menu, with the pixel art API answering that the given scenes have been saved. */
function renderMenu(scenesJson: object = {}) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url === '/api/pixel-art/scenes' ? scenesJson : {}))))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsMenu />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

test('shows a setting\'s choices only once that setting is picked', async () => {
  const user = userEvent.setup()
  renderMenu()
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.queryByRole('menuitemradio', { name: 'Sunrise' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('menuitem', { name: 'Time of day' }))

  expect(screen.getByRole('menuitemradio', { name: 'Sunrise' })).toBeInTheDocument()
})

test('hides the time of day choices when the weather choices are opened', async () => {
  const user = userEvent.setup()
  renderMenu()
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('menuitem', { name: 'Time of day' }))

  await user.click(screen.getByRole('menuitem', { name: 'Weather' }))

  expect(screen.queryByRole('menuitemradio', { name: 'Sunrise' })).not.toBeInTheDocument()
  expect(screen.getByRole('menuitemradio', { name: 'Rain' })).toBeInTheDocument()
})

test('hides a setting\'s choices when that setting is picked again', async () => {
  const user = userEvent.setup()
  renderMenu()
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('menuitem', { name: 'Weather' }))

  await user.click(screen.getByRole('menuitem', { name: 'Weather' }))

  expect(screen.queryByRole('menuitemradio', { name: 'Rain' })).not.toBeInTheDocument()
})

test("offers each scene of one's own when there are some", async () => {
  const user = userEvent.setup()
  renderMenu({
    'custom-christmas': {
      name: 'Christmas',
      time_of_day: 'night',
      weather: 'snow',
      layer_ids: ['sky'],
    },
  })
  await user.click(screen.getByRole('button', { name: 'Settings' }))

  await user.click(await screen.findByRole('menuitem', { name: 'Scene' }))

  expect(screen.getByRole('menuitemradio', { name: 'Christmas' })).toBeInTheDocument()
  expect(screen.getByRole('menuitemradio', { name: 'Time and weather' })).toBeChecked()
})

test('leaves out the choice of scene when there is nothing to choose but the time and weather', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: 'Settings' }))

  expect(screen.queryByRole('menuitem', { name: 'Scene' })).not.toBeInTheDocument()
})

test("offers and ticks one of the site's own scenes when it was chosen for this screen", async () => {
  localStorage.setItem('kiosk-viewer-settings', JSON.stringify({ chosenSceneId: 'night-drizzle' }))
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({}))))
  // The settings module reads storage once, when it is first imported, so this test imports a fresh copy, with the query
  // library it shares its state through.
  vi.resetModules()
  const { SettingsMenu: FreshSettingsMenu } = await import('@/components/SettingsMenu')
  const { QueryClient: FreshQueryClient, QueryClientProvider: FreshQueryClientProvider } = await import('@tanstack/react-query')
  render(
    <FreshQueryClientProvider client={new FreshQueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FreshSettingsMenu />
    </FreshQueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Settings' }))

  await user.click(await screen.findByRole('menuitem', { name: 'Scene' }))

  expect(screen.getByRole('menuitemradio', { name: 'Night, drizzle' })).toBeChecked()
})
