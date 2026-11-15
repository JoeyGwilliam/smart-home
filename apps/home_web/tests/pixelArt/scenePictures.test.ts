import { SCENE_PICTURES } from '@/pixelArt/scenePictures'

const VARIANTS = SCENE_PICTURES.flatMap((picture) => picture.variants.map((variant) => [`${picture.id}: ${variant.name}`, variant] as const))

test.each(VARIANTS)('has frames of the same size, all coloured by the palette, when the variant is %s', (_name, variant) => {
  const sizes = new Set(variant.frames.flatMap((frame) => frame.rows.map((row) => `${frame.rows.length}x${row.length}`)))
  const unknownCharacters = variant.frames.flatMap((frame) => [...frame.rows.join('')].filter((character) => character !== '.' && !(character in variant.palette)))

  expect(sizes.size).toBe(1)
  expect(unknownCharacters).toEqual([])
})

test('gives every picture a different id that the pixel art API accepts', () => {
  const ids = SCENE_PICTURES.map((picture) => picture.id)

  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.filter((id) => !/^[a-z0-9-]{1,64}$/.test(id))).toEqual([])
})

test('gives every variant of a picture a different name', () => {
  const picturesWithRepeatedNames = SCENE_PICTURES.filter((picture) => new Set(picture.variants.map((variant) => variant.name)).size !== picture.variants.length)

  expect(picturesWithRepeatedNames).toEqual([])
})

test('makes the falling rain join up when its last frame leads back into its first', () => {
  const rain = SCENE_PICTURES.find((picture) => picture.id === 'rain')!.variants[0]

  expect(rain.frames).toHaveLength(32)
  expect(new Set(rain.frames.map((frame) => frame.rows.join('\n'))).size).toBe(32)
})
