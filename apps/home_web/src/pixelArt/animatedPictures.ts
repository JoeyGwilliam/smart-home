import { CHARCOAL, CREAM } from '@/components/PixelSprite'
import { shiftSprite } from '@/pixelArt/editSprite'
import type { ArtFrame, ArtVariant, PixelArt } from '@/pixelArt/pixelArt'

// The site's own pictures that move frame by frame, as the site draws them until someone redraws them. Their frames
// would be tedious to write out, so they are worked out from a single drawing, in the same ways that the pixel art page
// offers for making frames by hand: sliding a copy of a frame a little further each time, and fading it.

/**
 * Makes the frames of a tile that falls: each frame is the one before, slid a little further, with what leaves one
 * edge coming back in at the opposite one. The frames must slide a whole number of tiles between them, across and down,
 * so that the last leads back into the first.
 *
 * @param tileSize The width and height of the tile, in pixels.
 * @param particles Where each drop or flake sits in the tile, and how tall it is.
 * @param slide How far each frame slides from the one before, and how long it shows.
 * @param frameCount How many frames there are.
 * @returns The frames.
 */
function drawFalling(
  tileSize: number,
  particles: { x: number; y: number; height: number }[],
  slide: { across: number; down: number; milliseconds: number },
  frameCount: number,
): ArtFrame[] {
  const isParticle = (x: number, y: number) => particles.some((particle) => x === particle.x && y >= particle.y && y < particle.y + particle.height)
  const firstFrame = Array.from({ length: tileSize }, (_, y) => Array.from({ length: tileSize }, (_, x) => (isParticle(x, y) ? 'p' : '.')).join(''))
  return Array.from({ length: frameCount }, (_, index) => ({
    rows: shiftSprite({ rows: firstFrame, palette: {} }, slide.across * index, slide.down * index).rows,
    milliseconds: slide.milliseconds,
  }))
}

/**
 * Rain, as a tile that is repeated over the whole screen. It is kept sparse and unhurried: a gentle shower is pleasant
 * to look at, where a downpour is grim. Drizzle is lighter: half as many drops, each a single pixel, falling more
 * slowly. Both lean to the left as they fall, one pixel across in every frame, which takes 32 frames to cross the tile.
 */
export const RAIN: PixelArt = {
  id: 'rain',
  title: 'Rain',
  group: 'Weather',
  variants: [
    {
      name: 'Rain',
      palette: { p: 'var(--rain)' },
      frames: drawFalling(
        32,
        [
          { x: 4, y: 2, height: 2 },
          { x: 20, y: 9, height: 2 },
          { x: 11, y: 18, height: 2 },
          { x: 27, y: 26, height: 2 },
        ],
        { across: -1, down: 4, milliseconds: 140 },
        32,
      ),
    },
    {
      name: 'Drizzle',
      palette: { p: 'var(--rain)' },
      frames: drawFalling(
        32,
        [
          { x: 6, y: 5, height: 1 },
          { x: 22, y: 21, height: 1 },
        ],
        { across: -1, down: 3, milliseconds: 170 },
        32,
      ),
    },
  ],
}

/** Snow, as a tile that is repeated over the whole screen, falling straight down and slowly. */
export const SNOW: PixelArt = {
  id: 'snow',
  title: 'Snow',
  group: 'Weather',
  variants: [
    {
      name: 'Falling',
      palette: { p: 'var(--snow)' },
      frames: drawFalling(
        16,
        [
          { x: 3, y: 2, height: 1 },
          { x: 11, y: 6, height: 1 },
          { x: 7, y: 11, height: 1 },
          { x: 14, y: 14, height: 1 },
        ],
        { across: 0, down: 1, milliseconds: 220 },
        16,
      ),
    },
  ],
}

/**
 * A double flash every eleven seconds, stretched over the whole screen. It is kept dim and brief, so that it is gentle
 * on the eyes: almost all of its time is the first, empty frame.
 */
export const LIGHTNING: PixelArt = {
  id: 'lightning',
  title: 'Lightning',
  group: 'Weather',
  variants: [
    {
      name: 'Double flash',
      palette: { b: '#ffffff66', d: '#ffffff33' },
      frames: [
        { rows: ['.'], milliseconds: 10_010 },
        { rows: ['b'], milliseconds: 165 },
        { rows: ['.'], milliseconds: 110 },
        { rows: ['d'], milliseconds: 165 },
        { rows: ['.'], milliseconds: 550 },
      ],
    },
  ],
}

/**
 * Makes a variant of something small floating up and away to the right, fading in and then out, over and over.
 *
 * @param name The variant's name.
 * @param shape The thing that floats, with any character but "." for its pixels.
 * @param colour Its colour, as "#rrggbb".
 * @param rise How far it floats across and up over the loop, in pixels, and how long each frame shows.
 * @param starts The frame at which each copy of the thing sets off, so that several can follow each other up.
 * @param frameCount How many frames the loop has.
 * @returns The variant. Its frames are big enough to hold the whole of the float.
 */
function drawFloatingAway(
  name: string,
  shape: string[],
  colour: string,
  rise: { across: number; up: number; milliseconds: number },
  starts: number[],
  frameCount: number,
): ArtVariant {
  const width = shape[0].length + rise.across
  const height = shape.length + rise.up

  const frames = Array.from({ length: frameCount }, (_, frameIndex) => {
    const pixels = Array.from({ length: height }, () => Array<string>(width).fill('.'))
    for (const start of starts) {
      // How far through its float this copy is, from 0 as it sets off to 1 as it vanishes.
      const progress = ((frameIndex - start + frameCount) % frameCount) / (frameCount - 1)
      const left = Math.round(progress * rise.across)
      const top = rise.up - Math.round(progress * rise.up)
      const key = progress < 0.1 ? 'c' : progress < 0.6 ? 'a' : progress < 0.85 ? 'b' : 'c'
      shape.forEach((row, y) => [...row].forEach((character, x) => character !== '.' && (pixels[top + y][left + x] = key)))
    }
    return { rows: pixels.map((row) => row.join('')), milliseconds: rise.milliseconds }
  })
  // The same colour at three strengths: solid, fading, and nearly gone.
  return { name, palette: { a: colour, b: `${colour}aa`, c: `${colour}55` }, frames }
}

/** Zzzs rising slowly, one after another, each fading as it floats away. Scenes place them above sleeping animals. */
export const ZZZ: PixelArt = {
  id: 'zzz',
  title: 'Zzz',
  group: 'Animals',
  variants: [drawFloatingAway('Rising', ['zzzzz', '...z.', '..z..', '.z...', 'zzzzz'], CREAM, { across: 5, up: 18, milliseconds: 750 }, [0, 4], 8)],
}

/**
 * The word "yawn", in capitals, drifting up and away. Scenes place it above yawning animals, at half their pixel size,
 * as at full size the word would be wider than a cow.
 */
export const YAWN: PixelArt = {
  id: 'yawn',
  title: 'Yawn',
  group: 'Animals',
  variants: [
    drawFloatingAway(
      'Rising',
      ['k.k..k..k...k.k..k', 'k.k.k.k.k...k.kk.k', '.k..kkk.k.k.k.k.kk', '.k..k.k.k.k.k.k..k', '.k..k.k..k.k..k..k'],
      CHARCOAL,
      { across: 10, up: 36, milliseconds: 500 },
      [0],
      8,
    ),
  ],
}

/** A firefly's slow blink: dark for a while, then glowing, with a halo at its brightest. */
export const FIREFLY: PixelArt = {
  id: 'firefly',
  title: 'Firefly',
  group: 'Field',
  variants: [
    {
      name: 'Blinking',
      palette: { b: '#e9ff7a', d: '#e9ff7a88', h: '#d8f55a66' },
      frames: [
        { rows: ['...', '...', '...'], milliseconds: 1200 },
        { rows: ['...', '.d.', '...'], milliseconds: 300 },
        { rows: ['.h.', 'hbh', '.h.'], milliseconds: 900 },
        { rows: ['...', '.d.', '...'], milliseconds: 300 },
      ],
    },
  ],
}
