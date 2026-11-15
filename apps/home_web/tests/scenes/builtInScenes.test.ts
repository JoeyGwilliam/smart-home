import { BUILT_IN_LAYERS } from '@/scenes/builtInLayers'
import { BUILT_IN_SCENES, designBuiltInScene } from '@/scenes/builtInScenes'

const LAYER_IDS = BUILT_IN_LAYERS.map((layer) => layer.id)

test.each(BUILT_IN_SCENES.map((scene) => [scene.id, scene]))('stacks only known layers, in the order they are listed, when the scene is %s', (_id, scene) => {
  const positions = scene.design.layerIds.map((layerId) => LAYER_IDS.indexOf(layerId))

  expect(positions).not.toContain(-1)
  expect(positions).toEqual([...positions].sort((first, second) => first - second))
})

test('names the scene after its time of day and weather, and takes their colours', () => {
  const design = designBuiltInScene('sunset', 'drizzle')

  expect(design.name).toBe('Sunset, drizzle')
  expect(design.look).toEqual({ timeOfDay: 'sunset', weather: 'drizzle' })
})

test('stacks the sun, a few clouds, the animals and the butterflies on a clear day', () => {
  const design = designBuiltInScene('day', 'clear')

  expect(design.layerIds).toEqual(['sky', 'sun-day', 'fair-clouds', 'grass', 'animals-day', 'butterflies'])
})

test('stacks grey clouds, puddles, umbrellas and rain, without the sun, on a rainy day', () => {
  const design = designBuiltInScene('day', 'rain')

  expect(design.layerIds).toEqual(['sky', 'fair-clouds', 'grey-clouds', 'grass', 'puddles', 'animals-day', 'umbrellas', 'rain'])
})

test('shows the moon, stars and fireflies on a clear night, and only the moon and fireflies on a cloudy one', () => {
  const clearNight = designBuiltInScene('night', 'clear')
  const cloudyNight = designBuiltInScene('night', 'cloudy')

  expect(clearNight.layerIds).toEqual(expect.arrayContaining(['stars', 'moon', 'fireflies']))
  expect(cloudyNight.layerIds).toEqual(expect.arrayContaining(['moon', 'fireflies']))
  expect(cloudyNight.layerIds).not.toContain('stars')
})

test('adds snow clouds, a snowman and falling snow when it snows', () => {
  const design = designBuiltInScene('sunrise', 'snow')

  expect(design.layerIds).toEqual(expect.arrayContaining(['snow-clouds', 'snowman', 'snow']))
  expect(design.layerIds).not.toContain('umbrellas')
})

test('lays the lightning over everything else in a thunderstorm', () => {
  const design = designBuiltInScene('night', 'thunder')

  expect(design.layerIds.at(-1)).toBe('lightning')
})
