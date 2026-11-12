import type { CSSProperties } from 'react'

import { FieldLife } from '@/components/FieldLife'
import { CREAM, PixelSprite, SCENE_PIXEL_SIZE, type Sprite } from '@/components/PixelSprite'
import type { Scene, SceneWeather, TimeOfDay } from '@/scene/scene'

interface Cloud {
  /** Where the cloud sits in the sky, and how big it is. */
  className: string
  /** How long one crossing of the sky takes, so that the clouds move out of step with each other. */
  driftDuration: string
  /** How far into its crossing the cloud starts, written as a negative delay, so that the sky is never empty. */
  driftDelay: string
}

// Ordered so that any number taken from the start is spread across the sky.
const CLOUDS: Cloud[] = [
  { className: 'top-[8%] w-40', driftDuration: '140s', driftDelay: '-30s' },
  { className: 'top-[38%] w-56', driftDuration: '170s', driftDelay: '-95s' },
  { className: 'top-[22%] w-24', driftDuration: '190s', driftDelay: '-120s' },
  { className: 'top-[55%] w-32', driftDuration: '220s', driftDelay: '-10s' },
  { className: 'top-[14%] w-64', driftDuration: '150s', driftDelay: '-70s' },
  { className: 'top-[30%] w-48', driftDuration: '200s', driftDelay: '-160s' },
  { className: 'top-[3%] w-52', driftDuration: '180s', driftDelay: '-140s' },
  { className: 'top-[46%] w-44', driftDuration: '160s', driftDelay: '-45s' },
  { className: 'top-[18%] w-72', driftDuration: '210s', driftDelay: '-185s' },
  { className: 'top-[5%] w-60', driftDuration: '165s', driftDelay: '-5s' },
  { className: 'top-[34%] w-64', driftDuration: '185s', driftDelay: '-60s' },
  { className: 'top-[26%] w-52', driftDuration: '145s', driftDelay: '-110s' },
  { className: 'top-[11%] w-48', driftDuration: '230s', driftDelay: '-205s' },
  { className: 'top-[42%] w-60', driftDuration: '195s', driftDelay: '-150s' },
]

/** How many of the clouds each kind of weather has in the sky. */
const CLOUD_COUNTS: Record<SceneWeather, number> = { clear: 2, fog: 3, snow: 8, drizzle: 9, rain: 11, thunder: 11, cloudy: 14 }

/** The weather that falls as water, which leaves puddles on the grass. */
const WET_WEATHER: SceneWeather[] = ['drizzle', 'rain', 'thunder']

/** The weather that closes the top of the sky with unbroken cloud: anything wet, and an overcast sky. */
const WEATHER_WITH_CLOUD_BANK: SceneWeather[] = ['cloudy', ...WET_WEATHER]

/** The weather that leaves the sun or moon visible. In anything heavier, the cloud hides it. */
const WEATHER_SHOWING_SKY: SceneWeather[] = ['clear', 'cloudy']

const DISC_ROWS = ['..oooo..', '.oooooo.', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', '.oooooo.', '..oooo..']
const MIDDAY_SUN: Sprite = { rows: DISC_ROWS, palette: { o: '#ffd94a' } }
/** The sun near the horizon, where it glows orange. */
const LOW_SUN: Sprite = { rows: DISC_ROWS, palette: { o: '#ff9e4a' } }
const PUDDLE: Sprite = {
  rows: ['..wwwwww..', 'wwhhwwwwww', '..wwwwww..'],
  palette: { w: '#8fc1ee', h: '#d6eafc' },
}

/** Where along the grass each puddle lies: between the animals, so that none stands in one. */
const PUDDLE_CLASS_NAMES = ['left-[24%]', 'left-[48%]', 'left-[72%]', 'left-[93%]']

/** Each drawn pixel of the sun and moon is this many screen pixels across. */
const SUN_PIXEL_SIZE = 8

/**
 * Where the sun or moon sits at each time of day. At sunrise and sunset it is low enough for the grass to hide its
 * lower half, and between the animals so that none stands in front of it.
 */
const SUN_OR_MOON_CLASS_NAMES: Record<TimeOfDay, string> = {
  sunrise: 'bottom-[16px] left-[24%]',
  day: 'top-[12%] left-[14%]',
  sunset: 'right-[26%] bottom-[16px]',
  night: 'top-[12%] left-[14%]',
}

/**
 * Draws the moon as it looks from the northern hemisphere, where it fills from the right as it waxes and empties
 * from the right as it wanes.
 *
 * @param phase How far the moon is through its cycle (see Scene.moonPhase).
 * @returns The moon's disc, with the sunlit part bright and the rest only just visible against the night sky.
 */
function drawMoon(phase: number): Sprite {
  // Seen from Earth, the edge of the sunlit part crosses the disc as the cosine of the phase: at the right-hand rim
  // for a new moon, down the middle at a quarter, and at the left-hand rim for a full moon. Once the moon is waning,
  // the same edge is mirrored, and the sunlit part lies to its left.
  const isWaxing = phase < 0.5
  const litEdge = Math.cos(2 * Math.PI * phase) * (isWaxing ? 1 : -1)

  const rows = DISC_ROWS.map((row) => {
    const rowCentre = (row.indexOf('o') + row.lastIndexOf('o') + 1) / 2
    const rowHalfWidth = (row.lastIndexOf('o') - row.indexOf('o') + 1) / 2
    return [...row]
      .map((character, x) => {
        if (character === '.') return '.'
        // Where the middle of this pixel is across the disc: -1 at the left-hand rim and 1 at the right.
        const position = (x + 0.5 - rowCentre) / rowHalfWidth
        const isLit = isWaxing ? position > litEdge : position < litEdge
        return isLit ? 'o' : 'd'
      })
      .join('')
  })
  return { rows, palette: { o: CREAM, d: '#4d4f7d' } }
}

/**
 * The pixel-art scene behind the page: a banded sky above a strip of grass where farm animals stand. The scene
 * decides the rest: where the sun or moon sits, the moon's phase, how much cloud there is, and whether drizzle, rain,
 * snow, fog or lightning fills the air. The colours of the sky come from index.css, which follows the same scene.
 */
export function PixelBackdrop({ scene }: { scene: Scene }) {
  const { timeOfDay, weather, moonPhase } = scene
  const sunOrMoon = { sunrise: LOW_SUN, day: MIDDAY_SUN, sunset: LOW_SUN, night: drawMoon(moonPhase) }[timeOfDay]
  const isWet = WET_WEATHER.includes(weather)

  return (
    <div className="pixel-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {WEATHER_SHOWING_SKY.includes(weather) && (
        <div className={`absolute ${SUN_OR_MOON_CLASS_NAMES[timeOfDay]}`}>
          <PixelSprite sprite={sunOrMoon} pixelSize={SUN_PIXEL_SIZE} />
        </div>
      )}
      {timeOfDay === 'night' && weather === 'clear' && <BrightStars />}
      {CLOUDS.slice(0, CLOUD_COUNTS[weather]).map((cloud) => (
        <PixelCloud key={cloud.className} cloud={cloud} />
      ))}
      {WEATHER_WITH_CLOUD_BANK.includes(weather) && <CloudBank />}
      <PixelGrass />
      {isWet &&
        PUDDLE_CLASS_NAMES.map((className) => (
          <div key={className} className={`absolute bottom-[12px] dark:brightness-75 ${className}`}>
            <PixelSprite sprite={PUDDLE} pixelSize={SCENE_PIXEL_SIZE} />
          </div>
        ))}
      <FieldLife scene={scene} />
      {weather === 'fog' && <FogBanks />}
      {weather === 'drizzle' && <Precipitation kind={DRIZZLE} />}
      {(weather === 'rain' || weather === 'thunder') && <Precipitation kind={RAIN} />}
      {weather === 'snow' && <Precipitation kind={SNOW} />}
      {weather === 'thunder' && <div className="animate-lightning absolute inset-0 bg-white opacity-0" />}
    </div>
  )
}

const BRIGHT_STAR: Sprite = { rows: ['.o.', 'ooo', '.o.'], palette: { o: CREAM } }

/** Where the brighter stars sit, clear of the moon. */
const BRIGHT_STAR_CLASS_NAMES = ['top-[6%] left-[38%]', 'top-[16%] left-[62%]', 'top-[9%] left-[84%]', 'top-[28%] left-[50%]']

/** A few brighter stars, shining steadily among the fainter ones that index.css scatters over a clear night sky. */
function BrightStars() {
  return BRIGHT_STAR_CLASS_NAMES.map((className) => (
    <div key={className} className={`absolute ${className}`}>
      <PixelSprite sprite={BRIGHT_STAR} pixelSize={SCENE_PIXEL_SIZE} />
    </div>
  ))
}

function PixelCloud({ cloud }: { cloud: Cloud }) {
  return (
    <svg
      viewBox="0 0 16 7"
      shapeRendering="crispEdges"
      className={`animate-drift absolute left-0 ${cloud.className}`}
      style={{ '--drift-duration': cloud.driftDuration, '--drift-delay': cloud.driftDelay } as CSSProperties}
    >
      <g className="fill-(--cloud)">
        <rect x="5" y="0" width="5" height="2" />
        <rect x="2" y="2" width="11" height="2" />
        <rect x="0" y="4" width="16" height="2" />
      </g>
      <rect x="1" y="6" width="14" height="1" className="fill-(--cloud-shade)" />
    </svg>
  )
}

/** Each drawn pixel of the cloud bank is this many screen pixels across, to match the chunky drifting clouds. */
const CLOUD_BANK_PIXEL_SIZE = 8

/** Unbroken cloud along the top of the sky, with a billowing lower edge. Like the grass, it is sized in screen pixels. */
function CloudBank() {
  return (
    <svg shapeRendering="crispEdges" className="absolute inset-x-0 top-0 h-[72px] w-full">
      <defs>
        <pattern id="cloud-billows" width="16" height="5" patternUnits="userSpaceOnUse" patternTransform={`translate(0 32) scale(${CLOUD_BANK_PIXEL_SIZE})`}>
          <g className="fill-(--cloud-shade)">
            <rect x="0" y="1" width="16" height="1" />
            <rect x="0" y="2" width="6" height="2" />
            <rect x="8" y="2" width="7" height="1" />
            <rect x="1" y="4" width="4" height="1" />
            <rect x="9" y="3" width="4" height="1" />
          </g>
          <g className="fill-(--cloud)">
            <rect x="0" y="0" width="16" height="1" />
            <rect x="0" y="1" width="6" height="2" />
            <rect x="8" y="1" width="7" height="1" />
            <rect x="1" y="3" width="4" height="1" />
            <rect x="9" y="2" width="4" height="1" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="32" className="fill-(--cloud)" />
      <rect y="32" width="100%" height="40" fill="url(#cloud-billows)" />
    </svg>
  )
}

// The grass is sized in screen pixels rather than Tailwind's units, so that its drawing always fills it exactly.
function PixelGrass() {
  return (
    <svg shapeRendering="crispEdges" className="absolute inset-x-0 bottom-0 h-[48px] w-full">
      <defs>
        <pattern id="grass-tufts" width="8" height="4" patternUnits="userSpaceOnUse" patternTransform={`scale(${SCENE_PIXEL_SIZE})`}>
          <g className="fill-(--grass)">
            <rect x="0" y="2" width="8" height="2" />
            <rect x="1" y="1" width="1" height="1" />
            <rect x="4" y="0" width="1" height="2" />
            <rect x="6" y="1" width="2" height="1" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="16" fill="url(#grass-tufts)" />
      <rect y="16" width="100%" height="32" className="fill-(--grass)" />
      <rect y="36" width="100%" height="12" className="fill-(--grass-shade)" />
    </svg>
  )
}

/** Something that falls from the sky, drawn as one small tile that repeats across the whole screen. */
interface PrecipitationKind {
  /** Names the tile, and must differ between kinds. */
  id: string
  /** The width and height of the tile, in drawn pixels. A larger tile spreads its particles more thinly. */
  tileSize: number
  /** Where each drop or flake sits in the tile, and its size, in drawn pixels. */
  particles: { x: number; y: number; width: number; height: number }[]
  /** The colour of the particles. */
  className: string
  /** How long a particle takes to fall the height of one tile. */
  fallDuration: string
  /** How far a particle is blown to the left as it falls, as a fraction of the distance fallen. 0 falls straight down. */
  slant: number
}

// Rain is kept sparse, short and unhurried: a gentle shower is pleasant to look at, where a downpour is grim.
const RAIN: PrecipitationKind = {
  id: 'rain-drops',
  tileSize: 32,
  particles: [
    { x: 4, y: 2, width: 1, height: 2 },
    { x: 20, y: 9, width: 1, height: 2 },
    { x: 11, y: 18, width: 1, height: 2 },
    { x: 27, y: 26, width: 1, height: 2 },
  ],
  className: 'fill-(--rain)',
  fallDuration: '1.1s',
  slant: 0.25,
}

/** Lighter than rain: half as many drops, each a single pixel, falling more slowly. */
const DRIZZLE: PrecipitationKind = {
  id: 'drizzle-drops',
  tileSize: 32,
  particles: [
    { x: 6, y: 5, width: 1, height: 1 },
    { x: 22, y: 21, width: 1, height: 1 },
  ],
  className: 'fill-(--rain)',
  fallDuration: '1.8s',
  slant: 0.15,
}

const SNOW: PrecipitationKind = {
  id: 'snow-flakes',
  tileSize: 16,
  particles: [
    { x: 3, y: 2, width: 1, height: 1 },
    { x: 11, y: 6, width: 1, height: 1 },
    { x: 7, y: 11, width: 1, height: 1 },
    { x: 14, y: 14, width: 1, height: 1 },
  ],
  className: 'fill-(--snow)',
  fallDuration: '3.5s',
  slant: 0,
}

/**
 * Fills the screen with falling rain or snow. The tiles are sheared, so that each row of them sits a little to the
 * left of the row above, and the particles lean the same way. Sliding the drawing from one row to the next, over and
 * over, then looks like an endless slanting fall. The drawing overhangs the screen by that one slide: it starts a
 * tile above the top, and reaches past the right-hand edge by as far as it slides left.
 */
function Precipitation({ kind }: { kind: PrecipitationKind }) {
  const fallDistance = kind.tileSize * SCENE_PIXEL_SIZE
  const driftDistance = fallDistance * kind.slant

  return (
    <svg
      shapeRendering="crispEdges"
      className="animate-fall absolute left-0"
      style={
        {
          top: `-${fallDistance}px`,
          width: `calc(100% + ${driftDistance}px)`,
          height: `calc(100% + ${fallDistance}px)`,
          '--fall-distance': `${fallDistance}px`,
          '--fall-drift': `-${driftDistance}px`,
          '--fall-duration': kind.fallDuration,
        } as CSSProperties
      }
    >
      <defs>
        <pattern
          id={kind.id}
          width={kind.tileSize}
          height={kind.tileSize}
          patternUnits="userSpaceOnUse"
          // Scales the tile up to screen pixels, and shears it so that x moves left by `slant` for each unit of y.
          patternTransform={`matrix(${SCENE_PIXEL_SIZE} 0 ${-kind.slant * SCENE_PIXEL_SIZE} ${SCENE_PIXEL_SIZE} 0 0)`}
        >
          <g className={kind.className}>
            {kind.particles.map((particle) => (
              <rect key={`${particle.x},${particle.y}`} {...particle} />
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${kind.id})`} />
    </svg>
  )
}

/** Bands of mist lying across the scene, thickest near the ground. */
function FogBanks() {
  return (
    <>
      <div className="absolute inset-x-0 top-[30%] h-[24px] bg-(--fog)" />
      <div className="absolute inset-x-0 top-[52%] h-[40px] bg-(--fog)" />
      <div className="absolute inset-x-0 bottom-0 h-[25%] bg-(--fog)" />
    </>
  )
}
