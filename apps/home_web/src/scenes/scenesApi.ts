import { sendToHomeApi } from '@/homeApi/homeApi'
import type { SceneWeather, TimeOfDay } from '@/scene/scene'
import type { LayerDesign, PlacementMotion, PlacementSpread, SceneDesign, ScenePlacement } from '@/scenes/sceneDesign'

// nginx.conf and vite.config.ts forward these to the pixel art API.
const SCENES_URL = '/api/pixel-art/scenes'
const LAYERS_URL = '/api/pixel-art/layers'
const PRESETS_URL = '/api/pixel-art/presets'

/** A placement as the API sends and receives it. */
interface PlacementJson {
  id: string
  picture_id: string
  variant: string
  x: number
  anchor: 'top' | 'bottom'
  y: number
  pixel_size: number
  spread: PlacementSpread
  opacity: number
  is_flipped: boolean
  motion: PlacementMotion
}

interface SceneDesignJson {
  name: string
  time_of_day: TimeOfDay
  weather: SceneWeather
  layer_ids: string[]
}

interface LayerDesignJson {
  name: string
  placements: PlacementJson[]
}

/** A saved copy of the whole design, which can be put back at any time. The copy itself stays in the API. */
export interface Preset {
  id: string
  name: string
  /** When the preset was saved. */
  savedAt: Date
}

/**
 * Lists every scene that has been saved: the site's own scenes that have been changed, and scenes of one's own.
 *
 * @returns Each scene, keyed by its id.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function listScenes(): Promise<Record<string, SceneDesign>> {
  const response = await sendToHomeApi('pixel art', 'GET', SCENES_URL)
  const scenesJson: Record<string, SceneDesignJson> = await response.json()
  return Object.fromEntries(
    Object.entries(scenesJson).map(([sceneId, sceneJson]) => [
      sceneId,
      { name: sceneJson.name, look: { timeOfDay: sceneJson.time_of_day, weather: sceneJson.weather }, layerIds: sceneJson.layer_ids },
    ]),
  )
}

/**
 * Saves a scene, for every screen, replacing any scene already saved under its id.
 *
 * @param sceneId Such as "day-rain" for one of the site's own scenes, or an id made up for a scene of one's own.
 * @param scene The scene.
 * @throws RequestRefusedError If the API rejects the scene, which happens when its name is blank or too long, or it has
 *   more than 50 layers.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function saveScene(sceneId: string, scene: SceneDesign): Promise<void> {
  const sceneJson: SceneDesignJson = { name: scene.name, time_of_day: scene.look.timeOfDay, weather: scene.look.weather, layer_ids: scene.layerIds }
  await sendToHomeApi('pixel art', 'PUT', `${SCENES_URL}/${sceneId}`, sceneJson)
}

/**
 * Forgets a saved scene. One of the site's own scenes goes back to how the site designs it, and one of one's own is
 * gone. Does nothing if no scene is saved under the id.
 *
 * @param sceneId The scene's id.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function deleteScene(sceneId: string): Promise<void> {
  await sendToHomeApi('pixel art', 'DELETE', `${SCENES_URL}/${sceneId}`)
}

/**
 * Lists every layer that has been saved: the site's own layers that have been changed, and layers of one's own.
 *
 * @returns Each layer, keyed by its id.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function listLayers(): Promise<Record<string, LayerDesign>> {
  const response = await sendToHomeApi('pixel art', 'GET', LAYERS_URL)
  const layersJson: Record<string, LayerDesignJson> = await response.json()
  return Object.fromEntries(Object.entries(layersJson).map(([layerId, layerJson]) => [layerId, { name: layerJson.name, placements: layerJson.placements.map(parsePlacement) }]))
}

/**
 * Saves a layer, for every scene that uses it on every screen, replacing any layer already saved under its id.
 *
 * @param layerId Such as "rain" for one of the site's own layers, or an id made up for a layer of one's own.
 * @param layer The layer.
 * @throws RequestRefusedError If the API rejects the layer, which happens when its name is blank, or a picture is placed
 *   too far off the screen.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function saveLayer(layerId: string, layer: LayerDesign): Promise<void> {
  const layerJson: LayerDesignJson = { name: layer.name, placements: layer.placements.map(formatPlacement) }
  await sendToHomeApi('pixel art', 'PUT', `${LAYERS_URL}/${layerId}`, layerJson)
}

/**
 * Forgets a saved layer. One of the site's own layers goes back to how the site designs it, and one of one's own is gone.
 * Does nothing if no layer is saved under the id.
 *
 * @param layerId The layer's id.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function deleteLayer(layerId: string): Promise<void> {
  await sendToHomeApi('pixel art', 'DELETE', `${LAYERS_URL}/${layerId}`)
}

/**
 * Lists every preset.
 *
 * @returns All presets, oldest first.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function listPresets(): Promise<Preset[]> {
  const response = await sendToHomeApi('pixel art', 'GET', PRESETS_URL)
  const presetsJson: { id: string; name: string; saved_at: string }[] = await response.json()
  return presetsJson.map((preset) => ({ id: preset.id, name: preset.name, savedAt: new Date(preset.saved_at) }))
}

/**
 * Saves every picture, layer and scene as they are now, as a new preset.
 *
 * @param name What to call the preset.
 * @throws RequestRefusedError If the name is blank or longer than 80 characters.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function savePreset(name: string): Promise<void> {
  await sendToHomeApi('pixel art', 'POST', PRESETS_URL, { name })
}

/**
 * Makes every picture, layer and scene what it was when a preset was saved, on every screen.
 *
 * @param presetId The preset's id.
 * @throws RequestRefusedError If there is no such preset, which means it was deleted on another screen.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function applyPreset(presetId: string): Promise<void> {
  await sendToHomeApi('pixel art', 'POST', `${PRESETS_URL}/${presetId}/apply`)
}

/**
 * Saves every picture, layer and scene as they are now into a preset, in place of what it held.
 *
 * @param presetId The preset's id.
 * @throws RequestRefusedError If there is no such preset, which means it was deleted on another screen.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function overwritePreset(presetId: string): Promise<void> {
  await sendToHomeApi('pixel art', 'POST', `${PRESETS_URL}/${presetId}/overwrite`)
}

/**
 * Renames a preset, leaving what it holds as it is.
 *
 * @param presetId The preset's id.
 * @param name Its new name.
 * @throws RequestRefusedError If the name is blank or longer than 80 characters, or there is no such preset.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function renamePreset(presetId: string, name: string): Promise<void> {
  await sendToHomeApi('pixel art', 'PATCH', `${PRESETS_URL}/${presetId}`, { name })
}

/**
 * Deletes a preset, leaving the design as it is. Does nothing if there is no such preset.
 *
 * @param presetId The preset's id.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function deletePreset(presetId: string): Promise<void> {
  await sendToHomeApi('pixel art', 'DELETE', `${PRESETS_URL}/${presetId}`)
}

function parsePlacement(placement: PlacementJson): ScenePlacement {
  return {
    id: placement.id,
    pictureId: placement.picture_id,
    variant: placement.variant,
    x: placement.x,
    anchor: placement.anchor,
    y: placement.y,
    pixelSize: placement.pixel_size,
    spread: placement.spread,
    opacity: placement.opacity,
    isFlipped: placement.is_flipped,
    motion: placement.motion,
  }
}

function formatPlacement(placement: ScenePlacement): PlacementJson {
  return {
    id: placement.id,
    picture_id: placement.pictureId,
    variant: placement.variant,
    x: placement.x,
    anchor: placement.anchor,
    y: placement.y,
    pixel_size: placement.pixelSize,
    spread: placement.spread,
    opacity: placement.opacity,
    is_flipped: placement.isFlipped,
    motion: placement.motion,
  }
}
