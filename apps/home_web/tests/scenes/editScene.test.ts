import { RAIN } from '@/pixelArt/animatedPictures'
import { COW, GRASS, SUN } from '@/pixelArt/scenePictures'
import {
  addLayerToScene,
  addPlacement,
  changeAnchor,
  changePlacement,
  createPlacement,
  isSameDesign,
  moveLayerInScene,
  removeLayerFromScene,
  removePlacement,
  reorderPlacement,
} from '@/scenes/editScene'
import type { LayerDesign, SceneDesign } from '@/scenes/sceneDesign'

const SUN_PLACEMENT = createPlacement({ id: 'sun', pictureId: 'sun', x: 14, anchor: 'top', y: 12, pixelSize: 8 })
const GRASS_PLACEMENT = createPlacement({ id: 'grass', pictureId: 'grass', anchor: 'bottom', y: 0, spread: 'across' })

const LAYER: LayerDesign = { name: 'Summer things', placements: [SUN_PLACEMENT, GRASS_PLACEMENT] }
const RAINY_DAY: SceneDesign = { name: 'Rainy day', look: { timeOfDay: 'day', weather: 'rain' }, layerIds: ['sky', 'animals-day', 'rain'] }

test("fills in the usual variant, solid and staying put when creating a placement with only its position", () => {
  const placement = createPlacement({ id: 'cow', pictureId: 'cow', anchor: 'bottom', y: 28 })

  expect(placement).toMatchObject({ variant: '', spread: 'none', opacity: 100, isFlipped: false, motion: 'none' })
})

test("places a picture of the ground standing in the grass, in its first variant, when adding it", () => {
  const { design, placementId } = addPlacement(LAYER, COW)

  expect(placementId).toBe('cow-1')
  expect(design.placements.at(-1)).toMatchObject({ id: 'cow-1', pictureId: 'cow', variant: 'Standing', anchor: 'bottom', y: 28, spread: 'none' })
})

test('places a picture of the sky in the sky when adding it', () => {
  const { design } = addPlacement(LAYER, SUN)

  expect(design.placements.at(-1)).toMatchObject({ anchor: 'top', pixelSize: 8 })
})

test('spreads the grass across the screen and tiles the rain over all of it when adding them', () => {
  const { design: withGrass } = addPlacement(LAYER, GRASS)
  const { design: withRain } = addPlacement(withGrass, RAIN)

  expect(withRain.placements.slice(-2).map((placement) => placement.spread)).toEqual(['across', 'tile'])
})

test('gives each copy of a picture its own id when adding it twice', () => {
  const { design: withOneCow } = addPlacement(LAYER, COW)

  const { placementId } = addPlacement(withOneCow, COW)

  expect(placementId).toBe('cow-2')
})

test('keeps the placement within what the pixel art API allows when changing it', () => {
  const design = changePlacement(LAYER, 'sun', { x: 400, y: -90, pixelSize: 0, opacity: 120 })

  expect(design.placements[0]).toMatchObject({ x: 150, y: -50, pixelSize: 1, opacity: 100 })
})

test('keeps the picture where it is on the screen when counting its height from the bottom instead', () => {
  const design = changeAnchor(LAYER, 'sun', 'bottom', 1000, 64)

  expect(design.placements[0]).toMatchObject({ anchor: 'bottom', y: 1000 - 120 - 64 })
})

test('takes only that placement out when removing it', () => {
  const design = removePlacement(LAYER, 'sun')

  expect(design.placements.map((placement) => placement.id)).toEqual(['grass'])
})

test('swaps the placement with the one in front when bringing it forward', () => {
  const design = reorderPlacement(LAYER, 'sun', 'forward')

  expect(design.placements.map((placement) => placement.id)).toEqual(['grass', 'sun'])
})

test('leaves the order as it was when sending back the placement behind everything', () => {
  const design = reorderPlacement(LAYER, 'sun', 'back')

  expect(design.placements.map((placement) => placement.id)).toEqual(['sun', 'grass'])
})

test('treats layers as the same when only the order of their details differs', () => {
  const reordered: LayerDesign = { placements: LAYER.placements, name: LAYER.name }

  expect(isSameDesign(LAYER, reordered)).toBe(true)
})

test('puts the layer in front of everything when adding a layer to a scene', () => {
  const scene = addLayerToScene(RAINY_DAY, 'umbrellas')

  expect(scene.layerIds).toEqual(['sky', 'animals-day', 'rain', 'umbrellas'])
})

test('leaves the scene as it was when adding a layer that it already has', () => {
  const scene = addLayerToScene(RAINY_DAY, 'rain')

  expect(scene.layerIds).toEqual(['sky', 'animals-day', 'rain'])
})

test('takes only that layer out when removing a layer from a scene', () => {
  const scene = removeLayerFromScene(RAINY_DAY, 'animals-day')

  expect(scene.layerIds).toEqual(['sky', 'rain'])
})

test('swaps the layer with the one in front when bringing it forward', () => {
  const scene = moveLayerInScene(RAINY_DAY, 'animals-day', 'forward')

  expect(scene.layerIds).toEqual(['sky', 'rain', 'animals-day'])
})

test('leaves the order as it was when sending back the layer at the back', () => {
  const scene = moveLayerInScene(RAINY_DAY, 'sky', 'back')

  expect(scene.layerIds).toEqual(['sky', 'animals-day', 'rain'])
})
