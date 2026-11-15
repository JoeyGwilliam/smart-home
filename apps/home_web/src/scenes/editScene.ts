import { LIGHTNING, RAIN, SNOW } from '@/pixelArt/animatedPictures'
import type { PixelArt } from '@/pixelArt/pixelArt'
import { CLOUD_BANK, FAINT_STARS, FOG, GRASS, OVERCAST, SKY } from '@/pixelArt/scenePictures'
import type { PlacementSpread, SceneDesign, ScenePlacement } from '@/scenes/sceneDesign'

// Every function here gives a changed copy of a layer or a scene, leaving the one it was given as it was. The limits are
// the pixel art API's, so that whatever the pixel art page makes can be saved.

/** Something made of placed pictures: a layer. */
interface Placed {
  placements: ScenePlacement[]
}

/** How the site's own pictures that cover more than their own size are spread when they are added. */
const SPREADS_WHEN_ADDED: Record<string, PlacementSpread> = {
  [SKY.id]: 'screen',
  [OVERCAST.id]: 'screen',
  [FOG.id]: 'screen',
  [LIGHTNING.id]: 'screen',
  [FAINT_STARS.id]: 'tile',
  [RAIN.id]: 'tile',
  [SNOW.id]: 'tile',
  [GRASS.id]: 'across',
  [CLOUD_BANK.id]: 'across',
}

/**
 * Makes a placement, filling in every detail that isn't given with its plainest choice: the picture's usual variant,
 * solid, facing right, and staying where it is put.
 *
 * @param details The placement's id, picture and position, and any other details to choose.
 * @returns The placement.
 */
export function createPlacement(details: Partial<ScenePlacement> & Pick<ScenePlacement, 'id' | 'pictureId' | 'anchor' | 'y'>): ScenePlacement {
  return {
    variant: '',
    x: 0,
    pixelSize: 4,
    spread: 'none',
    opacity: 100,
    isFlipped: false,
    motion: 'none',
    ...details,
  }
}

/**
 * Adds a picture, in front of everything already there, near the middle of the screen: in the sky if it is a picture
 * of the sky, and standing in the grass otherwise. A sky, a strip of grass and the like cover the screen as they do in
 * the site's own scenes.
 *
 * @param design The layer to change.
 * @param picture The picture to add.
 * @returns The changed layer, and the id of the new placement.
 */
export function addPlacement<Design extends Placed>(design: Design, picture: PixelArt): { design: Design; placementId: string } {
  const takenIds = new Set(design.placements.map((placement) => placement.id))
  let number = 1
  while (takenIds.has(`${picture.id}-${number}`)) number += 1
  const placementId = `${picture.id}-${number}`

  const spread = SPREADS_WHEN_ADDED[picture.id] ?? 'none'
  const isInSky = picture.group === 'Sky' || spread !== 'none'
  const placement = createPlacement({
    id: placementId,
    pictureId: picture.id,
    x: 45,
    anchor: isInSky ? 'top' : 'bottom',
    y: spread === 'none' ? (isInSky ? 20 : 28) : 0,
    variant: picture.variants[0].name,
    pixelSize: picture.id === FAINT_STARS.id ? 2 : isInSky && spread === 'none' ? 8 : 4,
    spread,
  })
  return { design: { ...design, placements: [...design.placements, placement] }, placementId }
}

/**
 * Changes some of a placement's details, keeping its position and size within what the pixel art API allows. Does
 * nothing if there is no such placement.
 *
 * @param design The layer to change.
 * @param placementId The placement's id.
 * @param changes The details to change.
 * @returns The changed layer.
 */
export function changePlacement<Design extends Placed>(design: Design, placementId: string, changes: Partial<Omit<ScenePlacement, 'id'>>): Design {
  return {
    ...design,
    placements: design.placements.map((placement) => (placement.id === placementId ? keepWithinLimits({ ...placement, ...changes }) : placement)),
  }
}

/**
 * Moves which edge of the screen a placement counts its height from, keeping it where it is on a screen of the given
 * height.
 *
 * @param design The layer to change.
 * @param placementId The placement's id.
 * @param anchor The edge to count from.
 * @param screenHeight The height of the screen to keep it in place on, in screen pixels.
 * @param pictureHeight The placement's height, in screen pixels.
 * @returns The changed layer.
 */
export function changeAnchor<Design extends Placed>(design: Design, placementId: string, anchor: 'top' | 'bottom', screenHeight: number, pictureHeight: number): Design {
  const placement = design.placements.find((candidate) => candidate.id === placementId)
  if (!placement || placement.anchor === anchor) return design
  const y =
    anchor === 'bottom'
      ? screenHeight - (placement.y / 100) * screenHeight - pictureHeight
      : ((screenHeight - placement.y - pictureHeight) / screenHeight) * 100
  return changePlacement(design, placementId, { anchor, y: Math.round(y * 10) / 10 })
}

/**
 * Takes a placement out. Does nothing if there is no such placement.
 *
 * @returns The changed layer.
 */
export function removePlacement<Design extends Placed>(design: Design, placementId: string): Design {
  return { ...design, placements: design.placements.filter((placement) => placement.id !== placementId) }
}

/**
 * Brings a placement one step in front of the picture before it, or sends it one step behind the picture after it.
 * Does nothing if it is already in front of, or behind, everything.
 *
 * @param design The layer to change.
 * @param placementId The placement's id.
 * @param direction "forward" to bring it in front, "back" to send it behind.
 * @returns The changed layer.
 */
export function reorderPlacement<Design extends Placed>(design: Design, placementId: string, direction: 'forward' | 'back'): Design {
  const index = design.placements.findIndex((placement) => placement.id === placementId)
  const swapIndex = direction === 'forward' ? index + 1 : index - 1
  if (index === -1 || swapIndex < 0 || swapIndex >= design.placements.length) return design
  const placements = [...design.placements]
  ;[placements[index], placements[swapIndex]] = [placements[swapIndex], placements[index]]
  return { ...design, placements }
}

/** The most layers a scene can have, which the pixel art API also insists on. */
const MAX_LAYERS = 50

/**
 * Puts a layer in front of everything in a scene. Does nothing if the scene already has the layer, or as many layers as
 * it can.
 *
 * @returns The changed scene.
 */
export function addLayerToScene(scene: SceneDesign, layerId: string): SceneDesign {
  if (scene.layerIds.includes(layerId) || scene.layerIds.length >= MAX_LAYERS) return scene
  return { ...scene, layerIds: [...scene.layerIds, layerId] }
}

/**
 * Takes a layer out of a scene. The layer itself is kept, for other scenes. Does nothing if the scene doesn't have it.
 *
 * @returns The changed scene.
 */
export function removeLayerFromScene(scene: SceneDesign, layerId: string): SceneDesign {
  return { ...scene, layerIds: scene.layerIds.filter((id) => id !== layerId) }
}

/**
 * Brings a layer of a scene one step towards the front, or sends it one step towards the back. Does nothing if it is
 * already at the front, or the back, or isn't in the scene.
 *
 * @returns The changed scene.
 */
export function moveLayerInScene(scene: SceneDesign, layerId: string, direction: 'forward' | 'back'): SceneDesign {
  const index = scene.layerIds.indexOf(layerId)
  const swapIndex = direction === 'forward' ? index + 1 : index - 1
  if (index === -1 || swapIndex < 0 || swapIndex >= scene.layerIds.length) return scene
  const layerIds = [...scene.layerIds]
  ;[layerIds[index], layerIds[swapIndex]] = [layerIds[swapIndex], layerIds[index]]
  return { ...scene, layerIds }
}

/**
 * Makes up an id for a new picture, layer or scene of one's own, which none of the site's own can have.
 *
 * @returns Such as "custom-1a2b3c4d".
 */
export function makeCustomId(): string {
  return `custom-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Tells whether two layers or scenes are designed the same, however their details happen to be ordered.
 *
 * @returns Whether they are the same.
 */
export function isSameDesign(first: object, second: object): boolean {
  return stringifyInKeyOrder(first) === stringifyInKeyOrder(second)
}

function stringifyInKeyOrder(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested !== null && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([first], [second]) => first.localeCompare(second)))
      : nested,
  )
}

function keepWithinLimits(placement: ScenePlacement): ScenePlacement {
  const yLimits = placement.anchor === 'top' ? [-50, 150] : [-500, 2000]
  return {
    ...placement,
    x: clamp(placement.x, -50, 150),
    y: clamp(placement.y, yLimits[0], yLimits[1]),
    pixelSize: clamp(Math.round(placement.pixelSize), 1, 32),
    opacity: clamp(Math.round(placement.opacity), 0, 100),
  }
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest)
}
