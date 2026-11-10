import type { CSSProperties } from 'react'

/** Each drawn pixel of the grass and the animals is this many screen pixels across. */
const SCENE_PIXEL_SIZE = 4

interface Cloud {
  /** Where the cloud sits in the sky, and how big it is. */
  className: string
  /** How long one crossing of the sky takes, so that the clouds move out of step with each other. */
  driftDuration: string
  /** How far into its crossing the cloud starts, written as a negative delay, so that the sky is never empty. */
  driftDelay: string
}

const CLOUDS: Cloud[] = [
  { className: 'top-[8%] w-40', driftDuration: '140s', driftDelay: '-30s' },
  { className: 'top-[22%] w-24', driftDuration: '190s', driftDelay: '-120s' },
  { className: 'top-[38%] w-56', driftDuration: '170s', driftDelay: '-95s' },
  { className: 'top-[55%] w-32', driftDuration: '220s', driftDelay: '-10s' },
]

/**
 * A picture drawn as rows of pixels. Each character is one pixel, and stands for the colour that `palette` gives it.
 * A full stop is a transparent pixel. Every row must be the same length.
 */
interface Sprite {
  rows: string[]
  palette: Record<string, string>
}

const CREAM = '#fff8e7'
const CHARCOAL = '#3d302c'

const CHICKEN: Sprite = {
  rows: [
    '.....r..',
    '....www.',
    '....wkwo',
    'w..wwww.',
    'wwwwwww.',
    '.wwwwww.',
    '..wwww..',
    '...o.o..',
  ],
  palette: { w: CREAM, k: CHARCOAL, r: '#d9412f', o: '#f29a2e' },
}

const SHEEP: Sprite = {
  rows: [
    '..wwwwww....',
    '.wwwwwwwwff.',
    'wwwwwwwwfeff',
    'wwwwwwwwffff',
    'wwwwwwwww...',
    '.wwwwwwww...',
    '..ff...ff...',
    '..ff...ff...',
  ],
  palette: { w: CREAM, f: CHARCOAL, e: CREAM },
}

const COW: Sprite = {
  rows: [
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
  palette: { w: CREAM, b: '#6b4a3a', k: CHARCOAL, h: '#d8c9a8', p: '#f2a7b0' },
}

interface Animal {
  sprite: Sprite
  /** Where along the grass the animal stands, and which way it faces. Sprites are drawn facing right. */
  className: string
  /** How often the animal hops, so that the animals hop out of step with each other. */
  hopInterval: string
}

const ANIMALS: Animal[] = [
  { sprite: COW, className: 'left-[10%]', hopInterval: '7s' },
  { sprite: CHICKEN, className: 'left-[36%] -scale-x-100', hopInterval: '2.3s' },
  { sprite: SHEEP, className: 'left-[60%]', hopInterval: '5s' },
  { sprite: CHICKEN, className: 'left-[82%]', hopInterval: '3.1s' },
]

/**
 * The pixel-art scene behind the page: a banded sky that clouds drift across, above a strip of grass where farm
 * animals stand. Night mode adds stars.
 */
export function PixelBackdrop() {
  return (
    <div className="pixel-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {CLOUDS.map((cloud) => (
        <PixelCloud key={cloud.className} cloud={cloud} />
      ))}
      <PixelGrass />
      {ANIMALS.map((animal) => (
        // The animals stand a little way into the grass rather than on its top edge, so that they look planted in the field.
        <div
          key={animal.className}
          className={`animate-hop absolute bottom-[28px] dark:brightness-75 ${animal.className}`}
          style={{ '--hop-interval': animal.hopInterval } as CSSProperties}
        >
          <PixelSprite sprite={animal.sprite} />
        </div>
      ))}
    </div>
  )
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

function PixelSprite({ sprite }: { sprite: Sprite }) {
  const width = sprite.rows[0].length
  const height = sprite.rows.length

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * SCENE_PIXEL_SIZE}
      height={height * SCENE_PIXEL_SIZE}
      shapeRendering="crispEdges"
      className="block"
    >
      {sprite.rows.flatMap((row, y) =>
        [...row].map((character, x) =>
          character === '.' ? null : <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={sprite.palette[character]} />,
        ),
      )}
    </svg>
  )
}
