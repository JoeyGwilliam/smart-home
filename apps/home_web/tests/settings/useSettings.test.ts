import { act, renderHook } from '@testing-library/react'

// The settings module reads storage once, when it is first imported, so each test imports a fresh copy.
async function importUseSettings() {
  vi.resetModules()
  const { useSettings } = await import('@/settings/useSettings')
  return useSettings
}

afterEach(() => {
  localStorage.clear()
})

test('follows the real time of day when nothing has been stored', async () => {
  const useSettings = await importUseSettings()

  const { result } = renderHook(() => useSettings())

  expect(result.current[0].sceneTime).toBe('live')
})

test('uses the stored choice when a time of day was chosen before', async () => {
  localStorage.setItem('kiosk-viewer-settings', JSON.stringify({ sceneTime: 'night' }))
  const useSettings = await importUseSettings()

  const { result } = renderHook(() => useSettings())

  expect(result.current[0].sceneTime).toBe('night')
})

test('remembers a change when the page is reloaded', async () => {
  const useSettingsBeforeReload = await importUseSettings()
  const { result: beforeReload } = renderHook(() => useSettingsBeforeReload())

  act(() => beforeReload.current[1]({ sceneTime: 'night' }))
  const useSettingsAfterReload = await importUseSettings()
  const { result: afterReload } = renderHook(() => useSettingsAfterReload())

  expect(afterReload.current[0].sceneTime).toBe('night')
})

test('shares a change with every component when one changes a setting', async () => {
  const useSettings = await importUseSettings()
  const { result: changingComponent } = renderHook(() => useSettings())
  const { result: otherComponent } = renderHook(() => useSettings())

  act(() => changingComponent.current[1]({ sceneTime: 'night' }))

  expect(otherComponent.current[0].sceneTime).toBe('night')
})

test('uses the defaults when the stored settings are unreadable', async () => {
  localStorage.setItem('kiosk-viewer-settings', 'not json')
  const useSettings = await importUseSettings()

  const { result } = renderHook(() => useSettings())

  expect(result.current[0].sceneTime).toBe('live')
})
