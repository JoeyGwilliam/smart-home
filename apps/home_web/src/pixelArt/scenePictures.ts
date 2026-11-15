import { CHARCOAL, CREAM } from '@/components/PixelSprite'
import { FIREFLY, LIGHTNING, RAIN, SNOW, YAWN, ZZZ } from '@/pixelArt/animatedPictures'
import { createStillVariant, type PixelArt } from '@/pixelArt/pixelArt'

// Every picture of the site's own, as the site draws it until someone redraws it. The ones here stand still, or have
// only a couple of frames; the ones that are drawn frame by frame, such as the rain, are in animatedPictures. Layers
// decide where pictures go (see SceneDesign), and SceneBackdrop draws them.

const GRASS_GREEN = '#5f9e3f'
/** A shut eye on a pale face, which reads as closed next to the dark open eye. */
const EYELID = '#c9a98f'

/** Colours that index.css changes with the time of day and the weather, so that they always suit the sky. */
const CLOUD_PALETTE = { c: 'var(--cloud)', s: 'var(--cloud-shade)' }

/** The sky behind the site's own scenes: two bands that lighten towards the horizon, stretched over the whole screen. */
export const SKY: PixelArt = {
  id: 'sky',
  title: 'Sky',
  group: 'Sky',
  variants: [
    createStillVariant('Banded', [...Array(6).fill('h'.repeat(64)), ...Array(8).fill('m'.repeat(64)), ...Array(22).fill('b'.repeat(64))], {
      h: 'var(--sky-high)',
      m: 'var(--sky-mid)',
      b: 'var(--background)',
    }),
  ],
}

const DISC_ROWS = ['..oooo..', '.oooooo.', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', '.oooooo.', '..oooo..']

/** The sun: yellow overhead, and orange near the horizon. */
export const SUN: PixelArt = {
  id: 'sun',
  title: 'Sun',
  group: 'Sky',
  variants: [createStillVariant('Midday', DISC_ROWS, { o: '#ffd94a' }), createStillVariant('Low', DISC_ROWS, { o: '#ff9e4a' })],
}

/** The full moon. SceneBackdrop shades whatever is drawn here to match the moon's phase. */
export const MOON: PixelArt = {
  id: 'moon',
  title: 'Moon, shaded by its phase',
  group: 'Sky',
  variants: [createStillVariant('Full', DISC_ROWS, { o: CREAM })],
  isShadedByMoonPhase: true,
}

export const BRIGHT_STAR: PixelArt = {
  id: 'bright-star',
  title: 'Bright star',
  group: 'Sky',
  variants: [createStillVariant('Star', ['.o.', 'ooo', '.o.'], { o: CREAM })],
}

/** Where each faint star sits in the tile of them, and how many pixels square it is. */
const FAINT_STAR_POSITIONS = [
  { x: 10, y: 15, size: 2 },
  { x: 65, y: 6, size: 1 },
  { x: 100, y: 35, size: 2 },
  { x: 40, y: 55, size: 1 },
  { x: 80, y: 80, size: 2 },
  { x: 20, y: 95, size: 1 },
  { x: 55, y: 110, size: 2 },
]
const FAINT_STARS_TILE_SIZE = 120

function drawFaintStars(): string[] {
  const isStar = (x: number, y: number) =>
    FAINT_STAR_POSITIONS.some((star) => x >= star.x && x < star.x + star.size && y >= star.y && y < star.y + star.size)
  return Array.from({ length: FAINT_STARS_TILE_SIZE }, (_, y) =>
    Array.from({ length: FAINT_STARS_TILE_SIZE }, (_, x) => (isStar(x, y) ? 's' : '.')).join(''),
  )
}

/** A few faint stars scattered over a tile, which the night repeats over the whole sky. */
export const FAINT_STARS: PixelArt = {
  id: 'faint-stars',
  title: 'Faint stars',
  group: 'Sky',
  variants: [createStillVariant('Scattered', drawFaintStars(), { s: '#fff6d5' })],
}

/** One of the clouds that drift across the sky. */
export const CLOUD: PixelArt = {
  id: 'cloud',
  title: 'Cloud',
  group: 'Sky',
  variants: [
    createStillVariant(
      'Fluffy',
      ['.....ccccc......', '.....ccccc......', '..ccccccccccc...', '..ccccccccccc...', 'cccccccccccccccc', 'cccccccccccccccc', '.ssssssssssssss.'],
      CLOUD_PALETTE,
    ),
  ],
}

/** Unbroken cloud along the top of the sky in grey weather, repeated across the screen. */
export const CLOUD_BANK: PixelArt = {
  id: 'cloud-bank',
  title: 'Cloud bank',
  group: 'Sky',
  variants: [
    createStillVariant(
      'Billowing',
      [
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'ccccccsscccccccs',
        'cccccc..sccccss.',
        'sccccs...ssss...',
        '.ssss...........',
      ],
      CLOUD_PALETTE,
    ),
  ],
}

/** The strip of grass along the bottom of the screen, repeated across it. */
export const GRASS: PixelArt = {
  id: 'grass',
  title: 'Grass',
  group: 'Field',
  variants: [
    createStillVariant(
      'Tufted',
      ['....g...', '.g..g.gg', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg', 'ssssssss', 'ssssssss', 'ssssssss'],
      { g: 'var(--grass)', s: 'var(--grass-shade)' },
    ),
  ],
}

/**
 * A single grey pixel, which grey weather stretches over the whole screen, partly see-through, to dull everything
 * beneath it.
 */
export const OVERCAST: PixelArt = {
  id: 'overcast',
  title: 'Overcast veil',
  group: 'Weather',
  variants: [createStillVariant('Grey', ['o'], { o: 'var(--overcast-tint)' })],
}

/** Bands of mist lying across the screen, thickest near the ground, stretched over the whole screen. */
export const FOG: PixelArt = {
  id: 'fog',
  title: 'Fog',
  group: 'Weather',
  variants: [
    createStillVariant(
      'Banks',
      ['....', '....', '....', '....', '....', '....', 'ffff', '....', '....', '....', 'ffff', 'ffff', '....', '....', '....', 'ffff', 'ffff', 'ffff', 'ffff', 'ffff'],
      { f: 'var(--fog)' },
    ),
  ],
}

export const PUDDLE: PixelArt = {
  id: 'puddle',
  title: 'Puddle',
  group: 'Weather',
  variants: [createStillVariant('Puddle', ['..wwwwww..', 'wwhhwwwwww', '..wwwwww..'], { w: '#8fc1ee', h: '#d6eafc' })],
}

export const SNOWMAN: PixelArt = {
  id: 'snowman',
  title: 'Snowman',
  group: 'Weather',
  variants: [
    createStillVariant(
      'Snowman',
      [
        '...kkk...',
        '...kkk...',
        '..kkkkk..',
        '..sssss..',
        '..sksks..',
        '..ssssoo.',
        '..sssss..',
        '.rrrrrrr.',
        '.sssrsss.',
        'ssssrssss',
        'sssskssss',
        'sssssssss',
        'sssskssss',
        '.sssssss.',
      ],
      { k: CHARCOAL, s: '#f4f8ff', o: '#f29a2e', r: '#d9412f' },
    ),
  ],
}

const UMBRELLA_ROWS = ['....uuu....', '..uuvuvuu..', '.uuvuuuvuu.', 'uuvuuuuuvuu', 'u.u..k..u.u', '.....k.....', '.....k.....', '.....kk....']

/** An umbrella, in a few colours. It is a picture of its own: wet weather simply places one above each animal. */
export const UMBRELLA: PixelArt = {
  id: 'umbrella',
  title: 'Umbrella',
  group: 'Weather',
  variants: [
    createStillVariant('Red', UMBRELLA_ROWS, { u: '#e2574c', v: '#ffd94a', k: CHARCOAL }),
    createStillVariant('Blue', UMBRELLA_ROWS, { u: '#7cc0ea', v: '#e6f4fc', k: CHARCOAL }),
    createStillVariant('Purple', UMBRELLA_ROWS, { u: '#b18fdc', v: '#f2a7b0', k: CHARCOAL }),
    createStillVariant('Yellow', UMBRELLA_ROWS, { u: '#ffd94a', v: '#f29a2e', k: CHARCOAL }),
  ],
}

const BUTTERFLY_FRAMES = [
  { rows: ['ww.ww', 'wwkww', '.w.w.'], milliseconds: 250 },
  // Its wings folded, halfway through a beat.
  { rows: ['.w.w.', '.wkw.', '..w..'], milliseconds: 250 },
]

/** A butterfly beating its wings, in a couple of colours. */
export const BUTTERFLY: PixelArt = {
  id: 'butterfly',
  title: 'Butterfly',
  group: 'Field',
  variants: [
    { name: 'Pink', palette: { w: '#f6b4d0', k: CHARCOAL }, frames: BUTTERFLY_FRAMES },
    { name: 'Yellow', palette: { w: '#ffd94a', k: CHARCOAL }, frames: BUTTERFLY_FRAMES },
  ],
}

const COW_PALETTE = { w: CREAM, b: '#6b4a3a', k: CHARCOAL, h: '#d8c9a8', p: '#f2a7b0', l: EYELID, g: GRASS_GREEN }

/** A cow, in each of its poses. */
export const COW: PixelArt = {
  id: 'cow',
  title: 'Cow',
  group: 'Animals',
  variants: [
    createStillVariant(
      'Standing',
      [
        '.........h...h',
        '.........wwwww',
        '.wwbbwwwwwkwkw',
        'wwwbbbwwwwwwww',
        'wwwwbwwbbwpppp',
        'wwwwwwwbbw....',
        '.wwwwwwwww....',
        '.ww.pp..ww....',
        '.ww.....ww....',
        '.kk.....kk....',
      ],
      COW_PALETTE,
    ),
    // Head down in the grass, with a mouthful of it.
    createStillVariant(
      'Eating',
      [
        '..............',
        '..............',
        '.wwbbwwwwww...',
        'wwwbbbwwwwwh.h',
        'wwwwbwwbbwwwww',
        'wwwwwwwbbwwkwk',
        '.wwwwwwwwwwwww',
        '.ww.pp..ww.wpp',
        '.ww.....ww..pp',
        '.kk.....kk..gg',
      ],
      COW_PALETTE,
    ),
    // Eyes screwed shut and jaw dropped open.
    createStillVariant(
      'Yawning',
      [
        '.........h...h',
        '.........wwwww',
        '.wwbbwwwwwlwlw',
        'wwwbbbwwwwwwww',
        'wwwwbwwbbwpppp',
        'wwwwwwwbbwpkkp',
        '.wwwwwwwwwpppp',
        '.ww.pp..ww....',
        '.ww.....ww....',
        '.kk.....kk....',
      ],
      COW_PALETTE,
    ),
    // Lying in the grass with its legs tucked under, eyes shut.
    createStillVariant(
      'Sleeping',
      ['.........h...h', '.........wwwww', '.wwbbwwwwwlwlw', 'wwwbbbwwwwwwww', 'wwwwbwwbbwpppp', 'wwwwwwwbbw....', '.wwwwwwwwww...'],
      COW_PALETTE,
    ),
  ],
}

// The sheep's face is dark, so its open eye is pale, and a closed eye is simply the face's colour.
const SHEEP_PALETTE = { w: CREAM, f: CHARCOAL, e: CREAM, m: '#f2a7b0', g: GRASS_GREEN }

/** A sheep, in each of its poses. */
export const SHEEP: PixelArt = {
  id: 'sheep',
  title: 'Sheep',
  group: 'Animals',
  variants: [
    createStillVariant(
      'Standing',
      ['..wwwwww....', '.wwwwwwwwff.', 'wwwwwwwwfeff', 'wwwwwwwwffff', 'wwwwwwwww...', '.wwwwwwww...', '..ff...ff...', '..ff...ff...'],
      SHEEP_PALETTE,
    ),
    createStillVariant(
      'Eating',
      ['..wwwwww....', '.wwwwwwww...', 'wwwwwwwwww..', 'wwwwwwwwwff.', 'wwwwwwwwwfff', '.wwwwwwwwfef', '..ff...fffff', '..ff...ff.gg'],
      SHEEP_PALETTE,
    ),
    createStillVariant(
      'Yawning',
      ['..wwwwww....', '.wwwwwwwwff.', 'wwwwwwwwffff', 'wwwwwwwwfmmf', 'wwwwwwwwwfff', '.wwwwwwww...', '..ff...ff...', '..ff...ff...'],
      SHEEP_PALETTE,
    ),
    createStillVariant('Sleeping', ['..wwwwww....', '.wwwwwwwwff.', 'wwwwwwwwffff', 'wwwwwwwwffff', 'wwwwwwwww...', '.wwwwwwwww..'], SHEEP_PALETTE),
  ],
}

const CHICKEN_PALETTE = { w: CREAM, k: CHARCOAL, r: '#d9412f', o: '#f29a2e', l: EYELID }

/** A chicken, in each of its poses. */
export const CHICKEN: PixelArt = {
  id: 'chicken',
  title: 'Chicken',
  group: 'Animals',
  variants: [
    createStillVariant('Standing', ['.....r..', '....www.', '....wkwo', 'w..wwww.', 'wwwwwww.', '.wwwwww.', '..wwww..', '...o.o..'], CHICKEN_PALETTE),
    // Pecking at the ground, beak first.
    createStillVariant('Eating', ['........', '........', 'w.......', 'ww.wwww.', 'wwwwwwwr', '.wwwwwww', '..wwwwkw', '...o.o.o'], CHICKEN_PALETTE),
    // Eyes shut and beak open wide.
    createStillVariant('Yawning', ['.....r.o', '....www.', '....wlw.', 'w..wwwwo', 'wwwwwww.', '.wwwwww.', '..wwww..', '...o.o..'], CHICKEN_PALETTE),
    // Settled down on its feet, like a hen on a nest.
    createStillVariant('Sleeping', ['.....r..', '....www.', 'w..wwlwo', 'wwwwwww.', 'wwwwwww.', '.wwwwww.'], CHICKEN_PALETTE),
  ],
}

/** Every picture of the site's own, in the order the pixel art page lists them. */
export const SCENE_PICTURES: PixelArt[] = [
  SKY,
  SUN,
  MOON,
  BRIGHT_STAR,
  FAINT_STARS,
  CLOUD,
  CLOUD_BANK,
  GRASS,
  BUTTERFLY,
  FIREFLY,
  COW,
  SHEEP,
  CHICKEN,
  ZZZ,
  YAWN,
  OVERCAST,
  FOG,
  PUDDLE,
  SNOWMAN,
  UMBRELLA,
  RAIN,
  SNOW,
  LIGHTNING,
]
