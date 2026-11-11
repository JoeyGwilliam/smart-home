import { useSyncExternalStore } from 'react'

import type { SceneWeather, TimeOfDay } from '@/scene/scene'
import type { ClaudeEffort, ClaudeModel } from '@/siteEditor/claudeSettings'

/**
 * Choices about how this screen looks and behaves. They belong to the device showing the page, not to the home.
 */
export interface Settings {
  /** The time of day that the backdrop shows. "live" follows the real sunrise and sunset. */
  sceneTime: TimeOfDay | 'live'
  /** The weather that the backdrop shows. "live" follows the forecast. */
  sceneWeather: SceneWeather | 'live'
  /** The model that works on the messages this device sends from the site editor. */
  claudeModel: ClaudeModel
  /** How hard Claude thinks about the messages this device sends from the site editor. */
  claudeEffort: ClaudeEffort
}

const DEFAULT_SETTINGS: Settings = { sceneTime: 'live', sceneWeather: 'live', claudeModel: 'default', claudeEffort: 'default' }

const STORAGE_KEY = 'kiosk-viewer-settings'

const listeners = new Set<() => void>()
let currentSettings = readStoredSettings()

/**
 * Provides this device's settings, and a way to change them that every component using this hook sees at once.
 * Changes are remembered by the browser, so they survive a reload.
 *
 * @returns The current settings, and a function that changes some of them.
 */
export function useSettings(): [Settings, (changes: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribe, () => currentSettings)
  return [settings, changeSettings]
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function changeSettings(changes: Partial<Settings>): void {
  currentSettings = { ...currentSettings, ...changes }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings))
  } catch (error) {
    // Storage can be full or blocked. The change still applies until the page reloads, which is the best available.
    console.warn('Could not remember the settings.', error)
  }
  listeners.forEach((listener) => listener())
}

function readStoredSettings(): Settings {
  try {
    // Stored settings are merged over the defaults, so that a setting added later starts at its default.
    const storedSettings: Partial<Settings> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return { ...DEFAULT_SETTINGS, ...storedSettings }
  } catch {
    // Unreadable or blocked storage means nothing useful was remembered, so the defaults are the right answer.
    return DEFAULT_SETTINGS
  }
}
