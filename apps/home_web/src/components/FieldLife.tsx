import type { CSSProperties } from 'react'

import { CHARCOAL, CREAM, PixelSprite, SCENE_PIXEL_SIZE, type Sprite } from '@/components/PixelSprite'
import type { Scene, SceneWeather, TimeOfDay } from '@/scene/scene'

/** What an animal is doing, which decides how it is drawn. Every species has a sprite for each. */
type AnimalPose = 'standing' | 'eating' | 'yawning' | 'sleeping'

/**
 * In every sprite, "S" marks where a scarf goes. It is drawn in the animal's own colour, so it only shows when the
 * scarf's colour replaces it (see wearScarf).
 */
const SCARF_RED = '#d9412f'
const GRASS_GREEN = '#5f9e3f'
/** A shut eye on a pale face, which reads as closed next to the dark open eye. */
const EYELID = '#c9a98f'

const COW_PALETTE = { w: CREAM, S: CREAM, b: '#6b4a3a', k: CHARCOAL, h: '#d8c9a8', p: '#f2a7b0', l: EYELID, g: GRASS_GREEN }
const COW: Record<AnimalPose, Sprite> = {
  standing: {
    rows: [
      '.........h...h',
      '.........wwwww',
      '.wwbbwwwwwkwkw',
      'wwwbbbwwwwwwww',
      'wwwwbwwbbSpppp',
      'wwwwwwwbbS....',
      '.wwwwwwwwS....',
      '.ww.pp..ww....',
      '.ww.....ww....',
      '.kk.....kk....',
    ],
    palette: COW_PALETTE,
  },
  // Head down in the grass, with a mouthful of it.
  eating: {
    rows: [
      '..............',
      '..............',
      '.wwbbwwwwww...',
      'wwwbbbwwwwwh.h',
      'wwwwbwwbbwSwww',
      'wwwwwwwbbwSkwk',
      '.wwwwwwwwwSwww',
      '.ww.pp..ww.wpp',
      '.ww.....ww..pp',
      '.kk.....kk..gg',
    ],
    palette: COW_PALETTE,
  },
  // Eyes screwed shut and jaw dropped open.
  yawning: {
    rows: [
      '.........h...h',
      '.........wwwww',
      '.wwbbwwwwwlwlw',
      'wwwbbbwwwwwwww',
      'wwwwbwwbbSpppp',
      'wwwwwwwbbSpkkp',
      '.wwwwwwwwSpppp',
      '.ww.pp..ww....',
      '.ww.....ww....',
      '.kk.....kk....',
    ],
    palette: COW_PALETTE,
  },
  // Lying in the grass with its legs tucked under, eyes shut.
  sleeping: {
    rows: [
      '.........h...h',
      '.........wwwww',
      '.wwbbwwwwwlwlw',
      'wwwbbbwwwwwwww',
      'wwwwbwwbbSpppp',
      'wwwwwwwbbS....',
      '.wwwwwwwwww...',
    ],
    palette: COW_PALETTE,
  },
}

// The sheep's face is dark, so its open eye is pale, and a closed eye is simply the face's colour.
const SHEEP_PALETTE = { w: CREAM, S: CREAM, f: CHARCOAL, e: CREAM, m: '#f2a7b0', g: GRASS_GREEN }
const SHEEP: Record<AnimalPose, Sprite> = {
  standing: {
    rows: [
      '..wwwwww....',
      '.wwwwwwwwff.',
      'wwwwwwwwfeff',
      'wwwwwwwwffff',
      'wwwwwwwSS...',
      '.wwwwwwwS...',
      '..ff...ff...',
      '..ff...ff...',
    ],
    palette: SHEEP_PALETTE,
  },
  eating: {
    rows: [
      '..wwwwww....',
      '.wwwwwwww...',
      'wwwwwwwwww..',
      'wwwwwwwwSff.',
      'wwwwwwwwSfff',
      '.wwwwwwwwfef',
      '..ff...fffff',
      '..ff...ff.gg',
    ],
    palette: SHEEP_PALETTE,
  },
  yawning: {
    rows: [
      '..wwwwww....',
      '.wwwwwwwwff.',
      'wwwwwwwwffff',
      'wwwwwwwwfmmf',
      'wwwwwwwSSfff',
      '.wwwwwwwS...',
      '..ff...ff...',
      '..ff...ff...',
    ],
    palette: SHEEP_PALETTE,
  },
  sleeping: {
    rows: [
      '..wwwwww....',
      '.wwwwwwwwff.',
      'wwwwwwwwffff',
      'wwwwwwwwffff',
      'wwwwwwwSS...',
      '.wwwwwwwww..',
    ],
    palette: SHEEP_PALETTE,
  },
}

const CHICKEN_PALETTE = { w: CREAM, S: CREAM, k: CHARCOAL, r: '#d9412f', o: '#f29a2e', l: EYELID }
const CHICKEN: Record<AnimalPose, Sprite> = {
  standing: {
    rows: [
      '.....r..',
      '....www.',
      '....wkwo',
      'w..wSSS.',
      'wwwwwww.',
      '.wwwwww.',
      '..wwww..',
      '...o.o..',
    ],
    palette: CHICKEN_PALETTE,
  },
  // Pecking at the ground, beak first.
  eating: {
    rows: [
      '........',
      '........',
      'w.......',
      'ww.wwww.',
      'wwwwwSSr',
      '.wwwwwww',
      '..wwwwkw',
      '...o.o.o',
    ],
    palette: CHICKEN_PALETTE,
  },
  // Eyes shut and beak open wide.
  yawning: {
    rows: [
      '.....r.o',
      '....www.',
      '....wlw.',
      'w..wSSSo',
      'wwwwwww.',
      '.wwwwww.',
      '..wwww..',
      '...o.o..',
    ],
    palette: CHICKEN_PALETTE,
  },
  // Settled down on its feet, like a hen on a nest.
  sleeping: {
    rows: [
      '.....r..',
      '....www.',
      'w..wwlwo',
      'wwwwSSS.',
      'wwwwwww.',
      '.wwwwww.',
    ],
    palette: CHICKEN_PALETTE,
  },
}

/**
 * The umbrella an animal holds in wet weather. Its pole comes down to the animal's back, so the animal looks as if it
 * is holding it. "u" and "v" are the canopy's two colours, which each animal chooses.
 */
const UMBRELLA_ROWS = [
  '....uuu....',
  '..uuvuvuu..',
  '.uuvuuuvuu.',
  'uuvuuuuuvuu',
  'u.u..k..u.u',
  '.....k.....',
  '.....k.....',
  '.....kk....',
]

const SNOWMAN: Sprite = {
  rows: [
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
  palette: { k: CHARCOAL, s: '#f4f8ff', o: '#f29a2e', r: SCARF_RED },
}

const SNORE: Sprite = { rows: ['zzzzz', '...z.', '..z..', '.z...', 'zzzzz'], palette: { z: CREAM } }

/**
 * The word "yawn", in capitals. Its letters are drawn at half the scene's pixel size (see Yawn), as at full size the
 * word would be wider than a cow.
 */
const YAWN_WORD: Sprite = {
  rows: [
    'k.k..k..k...k.k..k',
    'k.k.k.k.k...k.kk.k',
    '.k..kkk.k.k.k.k.kk',
    '.k..k.k.k.k.k.k..k',
    '.k..k.k..k.k..k..k',
  ],
  palette: { k: CHARCOAL },
}

const BUTTERFLY_ROWS = ['ww.ww', 'wwkww', '.w.w.']

interface Animal {
  species: Record<AnimalPose, Sprite>
  /** Where along the grass the animal stands, and which way it faces. Sprites are drawn facing right. */
  className: string
  /** How often the animal hops, so that the animals hop out of step with each other. */
  hopInterval: string
  /**
   * What the animal does at each time of day. Everyone sleeps at night, and only one or two at a time eat or yawn, so
   * that the field looks lively rather than drilled.
   */
  poses: Record<TimeOfDay, AnimalPose>
  /** Whether Zzzs float up from the animal while it sleeps. Only some do, so that the field isn't full of them. */
  isSnorer: boolean
  /** The canopy colours of the animal's umbrella. */
  umbrellaColours: { u: string; v: string }
}

const ANIMALS: Animal[] = [
  {
    species: COW,
    className: 'left-[10%]',
    hopInterval: '7s',
    poses: { sunrise: 'yawning', day: 'standing', sunset: 'eating', night: 'sleeping' },
    isSnorer: true,
    umbrellaColours: { u: '#e2574c', v: '#ffd94a' },
  },
  {
    species: CHICKEN,
    className: 'left-[36%] -scale-x-100',
    hopInterval: '2.3s',
    poses: { sunrise: 'standing', day: 'eating', sunset: 'standing', night: 'sleeping' },
    isSnorer: false,
    umbrellaColours: { u: '#7cc0ea', v: '#e6f4fc' },
  },
  {
    species: SHEEP,
    className: 'left-[60%]',
    hopInterval: '5s',
    poses: { sunrise: 'standing', day: 'eating', sunset: 'standing', night: 'sleeping' },
    isSnorer: true,
    umbrellaColours: { u: '#b18fdc', v: '#f2a7b0' },
  },
  {
    species: CHICKEN,
    className: 'left-[82%]',
    hopInterval: '3.1s',
    poses: { sunrise: 'yawning', day: 'standing', sunset: 'standing', night: 'sleeping' },
    isSnorer: false,
    umbrellaColours: { u: '#ffd94a', v: '#f29a2e' },
  },
]

const WET_WEATHER: SceneWeather[] = ['drizzle', 'rain', 'thunder']

/** Where the butterflies flutter, and how their loops are staggered, so that they never flap in step. */
const BUTTERFLIES = [
  { className: 'bottom-[64px] left-[20%]', colour: '#f6b4d0', flutterDuration: '13s', flutterDelay: '0s' },
  { className: 'bottom-[88px] left-[66%]', colour: '#ffd94a', flutterDuration: '17s', flutterDelay: '-6s' },
]

/** Where the fireflies hover, and how they blink out of step with each other. */
const FIREFLIES = [
  { className: 'bottom-[70px] left-[18%]', glowDuration: '3.2s', glowDelay: '0s' },
  { className: 'bottom-[110px] left-[30%]', glowDuration: '4.1s', glowDelay: '-1.5s' },
  { className: 'bottom-[60px] left-[50%]', glowDuration: '3.6s', glowDelay: '-2.6s' },
  { className: 'bottom-[96px] left-[72%]', glowDuration: '4.5s', glowDelay: '-0.8s' },
  { className: 'bottom-[76px] left-[90%]', glowDuration: '3.9s', glowDelay: '-3.1s' },
]

/**
 * Everything that lives in the field at the bottom of the backdrop, behaving as the scene suggests. The animals sleep
 * at night, yawn at sunrise and graze through the day; they hold umbrellas in the wet, wear scarves in the snow beside
 * a snowman, and jump at each flash of lightning. Butterflies come out on clear days, and fireflies on dry nights.
 */
export function FieldLife({ scene }: { scene: Scene }) {
  const { timeOfDay, weather } = scene
  const isNight = timeOfDay === 'night'

  return (
    <>
      {weather === 'snow' && (
        <div className="absolute bottom-[24px] left-[48%] dark:brightness-75">
          <PixelSprite sprite={SNOWMAN} pixelSize={SCENE_PIXEL_SIZE} />
        </div>
      )}
      {ANIMALS.map((animal) => (
        <FarmAnimal key={animal.className} animal={animal} timeOfDay={timeOfDay} weather={weather} />
      ))}
      {weather === 'clear' && timeOfDay === 'day' && BUTTERFLIES.map((butterfly) => <Butterfly key={butterfly.className} {...butterfly} />)}
      {isNight &&
        (weather === 'clear' || weather === 'cloudy') &&
        FIREFLIES.map((firefly) => (
          <span
            key={firefly.className}
            className={`animate-wander absolute size-[4px] ${firefly.className}`}
            style={{ '--wander-duration': `calc(${firefly.glowDuration} * 3)` } as CSSProperties}
          >
            <span
              className="animate-glow block size-full bg-[#e9ff7a] shadow-[0_0_6px_2px_#d8f55a]"
              style={{ '--glow-duration': firefly.glowDuration, '--glow-delay': firefly.glowDelay } as CSSProperties}
            />
          </span>
        ))}
    </>
  )
}

interface FarmAnimalProps {
  animal: Animal
  timeOfDay: TimeOfDay
  weather: SceneWeather
}

function FarmAnimal({ animal, timeOfDay, weather }: FarmAnimalProps) {
  const pose = animal.poses[timeOfDay]
  const sprite = weather === 'snow' ? wearScarf(animal.species[pose]) : animal.species[pose]
  // A sleeping or eating animal stays put, but thunder makes everyone jump, asleep or not.
  const isStill = pose === 'sleeping' || pose === 'eating'
  const animationClassName = weather === 'thunder' ? 'animate-startle' : isStill ? '' : 'animate-hop'

  return (
    // The animals stand a little way into the grass rather than on its top edge, so that they look planted in the field.
    <div
      className={`absolute bottom-[28px] dark:brightness-75 ${animal.className} ${animationClassName}`}
      style={{ '--hop-interval': animal.hopInterval } as CSSProperties}
    >
      {WET_WEATHER.includes(weather) && (
        // The pole's foot overlaps the animal's back by one drawn pixel, so that it looks held rather than floating.
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: `calc(100% - ${SCENE_PIXEL_SIZE}px)` }}>
          <PixelSprite sprite={{ rows: UMBRELLA_ROWS, palette: { ...animal.umbrellaColours, k: CHARCOAL } }} pixelSize={SCENE_PIXEL_SIZE} />
        </div>
      )}
      {pose === 'sleeping' && animal.isSnorer && <Snores />}
      {pose === 'yawning' && <Yawn />}
      <PixelSprite sprite={sprite} pixelSize={SCENE_PIXEL_SIZE} />
    </div>
  )
}

/** Gives an animal its scarf, by colouring in the pixels that its sprite marks for one. */
function wearScarf(sprite: Sprite): Sprite {
  return { ...sprite, palette: { ...sprite.palette, S: SCARF_RED } }
}

/** Zzzs rising slowly from above a sleeping animal's head, one after another, each fading as it floats away. */
function Snores() {
  return (
    <div className="absolute right-0 bottom-full">
      {['0s', '-2s', '-4s'].map((delay) => (
        <div key={delay} className="animate-float-away absolute bottom-0 left-0" style={{ '--float-delay': delay } as CSSProperties}>
          <PixelSprite sprite={SNORE} pixelSize={SCENE_PIXEL_SIZE} />
        </div>
      ))}
    </div>
  )
}

/** The word "yawn" drifting up from above a yawning animal's head, once every few seconds. */
function Yawn() {
  return (
    <div className="animate-float-away absolute right-0 bottom-full" style={{ '--float-duration': '4s' } as CSSProperties}>
      <PixelSprite sprite={YAWN_WORD} pixelSize={SCENE_PIXEL_SIZE / 2} />
    </div>
  )
}

interface ButterflyProps {
  className: string
  colour: string
  flutterDuration: string
  flutterDelay: string
}

/** A butterfly looping lazily over the grass. Its path and its wingbeat are separate animations, on nested elements. */
function Butterfly({ className, colour, flutterDuration, flutterDelay }: ButterflyProps) {
  return (
    <div
      className={`animate-flutter absolute ${className}`}
      style={{ '--flutter-duration': flutterDuration, '--flutter-delay': flutterDelay } as CSSProperties}
    >
      <div className="animate-flap">
        <PixelSprite sprite={{ rows: BUTTERFLY_ROWS, palette: { w: colour, k: CHARCOAL } }} pixelSize={SCENE_PIXEL_SIZE} />
      </div>
    </div>
  )
}
