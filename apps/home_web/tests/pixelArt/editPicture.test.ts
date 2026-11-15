import { addFrame, addVariant, changeFrameTime, editFrame, isSameVariants, removeFrame, removeVariant, renameVariant } from '@/pixelArt/editPicture'
import { paintPixel, resizeSprite } from '@/pixelArt/editSprite'
import type { ArtVariant } from '@/pixelArt/pixelArt'

const RED: ArtVariant = {
  name: 'Red',
  palette: { u: '#e2574c' },
  frames: [
    { rows: ['u.', '..'], milliseconds: 200 },
    { rows: ['.u', '..'], milliseconds: 300 },
  ],
}
const BLUE: ArtVariant = { name: 'Blue', palette: { u: '#7cc0ea' }, frames: [{ rows: ['u'], milliseconds: 200 }] }

test('redraws only that frame when painting on a frame', () => {
  const variants = editFrame([RED], 0, 1, (frame) => paintPixel(frame, 0, 1, 'u'))

  expect(variants[0].frames.map((frame) => frame.rows)).toEqual([
    ['u.', '..'],
    ['.u', 'u.'],
  ])
})

test('resizes every frame of the variant alike when resizing one frame', () => {
  const variants = editFrame([RED], 0, 0, (frame) => resizeSprite(frame, 3, 1))

  expect(variants[0].frames.map((frame) => frame.rows)).toEqual([['u..'], ['.u.']])
})

test('adds a copy of the variant straight after it, under a new name, when adding a variant', () => {
  const variants = addVariant([RED, BLUE], 0)

  expect(variants.map((variant) => variant.name)).toEqual(['Red', 'Red 2', 'Blue'])
  expect(variants[1].frames).toEqual(RED.frames)
})

test('renames the variant when the name is free', () => {
  const variants = renameVariant([RED, BLUE], 0, ' Crimson ')

  expect(variants[0].name).toBe('Crimson')
})

test('leaves the name as it was when another variant already has it', () => {
  const variants = renameVariant([RED, BLUE], 0, 'Blue')

  expect(variants[0].name).toBe('Red')
})

test('keeps the only variant when removing it', () => {
  const variants = removeVariant([RED], 0)

  expect(variants).toEqual([RED])
})

test('adds a copy of the frame straight after it when adding a frame', () => {
  const variants = addFrame([RED], 0, 0)

  expect(variants[0].frames.map((frame) => frame.rows[0])).toEqual(['u.', 'u.', '.u'])
})

test('keeps the only frame when removing it', () => {
  const variants = removeFrame([BLUE], 0, 0)

  expect(variants[0].frames).toHaveLength(1)
})

test('keeps the time between 20 and 60000 milliseconds when changing how long a frame shows', () => {
  const variants = changeFrameTime([RED], 0, 0, 5)

  expect(variants[0].frames[0].milliseconds).toBe(20)
})

test('treats variants as the same when only the order of their palette differs', () => {
  const reordered: ArtVariant = { ...RED, palette: { u: '#e2574c' } }

  expect(isSameVariants([RED], [reordered])).toBe(true)
})
