import { createStillVariant, findFrameAt, findStillFrame, findVariant, getFrameSprite, type PixelArt } from '@/pixelArt/pixelArt'

const BLINK = {
  name: 'Blinking',
  palette: { b: '#e9ff7a' },
  frames: [
    { rows: ['.'], milliseconds: 1000 },
    { rows: ['b'], milliseconds: 500 },
  ],
}

const FIREFLY: PixelArt = { id: 'firefly', title: 'Firefly', group: 'Field', variants: [createStillVariant('Still', ['b'], { b: '#e9ff7a' }), BLINK] }

test('gives the variant of that name when a placement asks for one the picture has', () => {
  const variant = findVariant(FIREFLY, 'Blinking')

  expect(variant).toBe(BLINK)
})

test('gives the first variant when a placement asks for one the picture does not have', () => {
  const variant = findVariant(FIREFLY, 'Dancing')

  expect(variant.name).toBe('Still')
})

test('gives the frame with the variant palette when getting a frame as a drawing', () => {
  const sprite = getFrameSprite(BLINK, 1)

  expect(sprite).toEqual({ rows: ['b'], palette: { b: '#e9ff7a' } })
})

test('shows the frame whose time the moment falls in, and how long it has left', () => {
  const frame = findFrameAt(BLINK, 1200)

  expect(frame).toEqual({ frameIndex: 1, millisecondsLeft: 300 })
})

test('starts the loop again when the moment is past the end of the variant', () => {
  const frame = findFrameAt(BLINK, 1500 * 4 + 250)

  expect(frame).toEqual({ frameIndex: 0, millisecondsLeft: 750 })
})

test('holds still on the frame with the most drawn on it', () => {
  const frameIndex = findStillFrame(BLINK)

  expect(frameIndex).toBe(1)
})
