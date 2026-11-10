import type { CSSProperties } from 'react'

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

/** The pixel-art scene behind the page: a banded sky that clouds drift across, above a strip of grass. Night mode adds stars. */
export function PixelBackdrop() {
  return (
    <div className="pixel-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {CLOUDS.map((cloud) => (
        <PixelCloud key={cloud.className} cloud={cloud} />
      ))}
      <PixelGrass />
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

/** Each drawn pixel of the grass is this many screen pixels across. */
const GRASS_PIXEL_SIZE = 4

function PixelGrass() {
  return (
    <svg shapeRendering="crispEdges" className="absolute inset-x-0 bottom-0 h-12 w-full">
      <defs>
        <pattern id="grass-tufts" width="8" height="4" patternUnits="userSpaceOnUse" patternTransform={`scale(${GRASS_PIXEL_SIZE})`}>
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
