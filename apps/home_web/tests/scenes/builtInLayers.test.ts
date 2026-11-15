import { SCENE_PICTURES } from '@/pixelArt/scenePictures'
import { BUILT_IN_LAYERS } from '@/scenes/builtInLayers'

const PICTURES = new Map(SCENE_PICTURES.map((picture) => [picture.id, picture]))

test.each(BUILT_IN_LAYERS.map((layer) => [layer.id, layer]))('places only known pictures and variants, each once, when the layer is %s', (_id, layer) => {
  const { placements } = layer.design

  expect(new Set(placements.map((placement) => placement.id)).size).toBe(placements.length)
  const unknown = placements.filter((placement) => !PICTURES.get(placement.pictureId)?.variants.some((variant) => placement.variant === '' || variant.name === placement.variant))
  expect(unknown).toEqual([])
})

test('gives every layer a different id that the pixel art API accepts', () => {
  const ids = BUILT_IN_LAYERS.map((layer) => layer.id)

  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.filter((id) => !/^[a-z0-9-]{1,64}$/.test(id))).toEqual([])
})

test('puts every animal to sleep at night, with Zzzs above the snorers after all of them', () => {
  const { placements } = BUILT_IN_LAYERS.find((layer) => layer.id === 'animals-night')!.design

  const animals = placements.filter((placement) => ['cow', 'sheep', 'chicken'].includes(placement.pictureId))
  expect(animals.every((animal) => animal.variant === 'Sleeping')).toBe(true)
  expect(placements.filter((placement) => placement.pictureId === 'zzz').map((placement) => placement.id)).toEqual(['zzz-cow', 'zzz-sheep'])
  expect(placements.findIndex((placement) => placement.pictureId === 'zzz')).toBeGreaterThan(placements.findLastIndex((placement) => animals.includes(placement)))
})

test('places an umbrella of its own colour above each animal, in a layer of their own', () => {
  const { placements } = BUILT_IN_LAYERS.find((layer) => layer.id === 'umbrellas')!.design

  expect(placements.every((placement) => placement.pictureId === 'umbrella')).toBe(true)
  expect(placements.map((placement) => placement.variant)).toEqual(['Red', 'Blue', 'Purple', 'Yellow'])
})

test('tiles the rain over the whole screen', () => {
  const { placements } = BUILT_IN_LAYERS.find((layer) => layer.id === 'rain')!.design

  expect(placements).toEqual([expect.objectContaining({ pictureId: 'rain', variant: 'Rain', spread: 'tile' })])
})
