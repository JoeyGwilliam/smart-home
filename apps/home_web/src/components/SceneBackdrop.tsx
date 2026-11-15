import { useId, type CSSProperties } from 'react'

import { PixelSprite, SpritePixels, type Sprite } from '@/components/PixelSprite'
import { addColour } from '@/pixelArt/editSprite'
import { findVariant, getFrameSprite, type ArtVariant } from '@/pixelArt/pixelArt'
import { useCurrentFrame } from '@/pixelArt/useCurrentFrame'
import { usePictures } from '@/pixelArt/usePictures'
import type { SceneWeather, TimeOfDay } from '@/scene/scene'
import type { ScenePlacement } from '@/scenes/sceneDesign'
import type { StackedLayer } from '@/scenes/useShownScene'
import { cn } from 'cn'

interface SceneBackdropProps {
  /** The time of day and weather whose colours the backdrop takes (see SceneDesign.look). */
  look: { timeOfDay: TimeOfDay; weather: SceneWeather }
  /** The layers to draw, back first. */
  layers: StackedLayer[]
  /** How far the moon is through its cycle (see Scene.moonPhase), which shades any picture that follows it. */
  moonPhase: number
  /**
   * Whether everything holds still, as the pixel art page shows a scene while a layer is being arranged. Each picture
   * then shows the frame with the most drawn on it, and a drifting picture stays where it first shows.
   */
  isStill?: boolean
  /**
   * The id of the layer whose pictures can be pressed, as on the pixel art page. Each of them is marked with its id, as
   * data-placement-id, so that a press on one can be told apart from a press on another; every other layer lets presses
   * through, however much of the screen it covers. Left out, nothing is marked.
   */
  editableLayerId?: string
  /** The id of a placement in the editable layer to outline, as the pixel art page does for the one being arranged. */
  highlightedPlacementId?: string | null
  /** Where the backdrop goes, such as "fixed inset-0". It fills that box. */
  className: string
}

/**
 * Draws a stack of layers, each over the ones before it, and each layer's pictures over the ones before them. The
 * backdrop takes the colours of its look, whatever the page around it looks like, as index.css sets every colour that
 * changes with the sky from the attributes here.
 */
export function SceneBackdrop({ look, layers, moonPhase, isStill = false, editableLayerId, highlightedPlacementId = null, className }: SceneBackdropProps) {
  const isDark = look.timeOfDay === 'night'
  // The patterns that spread pictures are drawn with are found by id across the whole page, so each backdrop names its
  // own, in case another is showing too, as on the pixel art page. React's ids hold colons, which ids in url() can't.
  const patternIdPrefix = `backdrop${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const allPlacements = layers.flatMap(({ design }) => design.placements)

  return (
    <div
      data-time-of-day={look.timeOfDay}
      data-weather={look.weather}
      className={cn(isDark ? 'dark' : 'light', '@container overflow-hidden bg-background', className)}
      aria-hidden
    >
      {layers.map(({ id: layerId, design }) =>
        design.placements.map((placement) => (
          <PlacedPicture
            key={`${layerId}-${placement.id}`}
            placement={placement}
            patternId={`${patternIdPrefix}-${layerId}-${placement.id}`}
            // Pictures that move alike are staggered, so that they don't move in step.
            turn={allPlacements.slice(0, allPlacements.indexOf(placement)).filter((earlier) => earlier.motion === placement.motion).length}
            moonPhase={moonPhase}
            isDimmed={isDark && placement.anchor === 'bottom' && placement.spread === 'none'}
            isStill={isStill}
            interaction={editableLayerId === undefined ? 'none' : editableLayerId === layerId ? 'editable' : 'passive'}
            isHighlighted={editableLayerId === layerId && placement.id === highlightedPlacementId}
          />
        )),
      )}
    </div>
  )
}

/** How long each drifting picture takes to cross the screen, in seconds, taken in turn, so that they drift out of step. */
const DRIFT_SECONDS = [140, 170, 190, 220, 150, 200, 180, 160, 210, 165, 185, 145, 230, 195]
/** How often each hopping picture hops, in seconds, taken in turn. */
const HOP_SECONDS = [7, 2.3, 5, 3.1]
/** How long each fluttering picture takes over one loop, and how far into it it starts, in seconds, taken in turn. */
const FLUTTERS = [
  { duration: 13, delay: 0 },
  { duration: 17, delay: -6 },
]
/** How long each wandering picture takes over one loop, in seconds, taken in turn. */
const WANDER_SECONDS = [9.6, 12.3, 10.8, 13.5, 11.7]

interface PlacedPictureProps {
  placement: ScenePlacement
  /** Names any pattern that the picture is drawn with, which must differ between pictures and backdrops. */
  patternId: string
  /** How many pictures before this one move in the same way, which picks its timing. */
  turn: number
  moonPhase: number
  /** Whether the picture is darkened, as things on the ground are at night. */
  isDimmed: boolean
  isStill: boolean
  /** Whether the picture can be pressed and is marked with its id, lets presses through, or neither. */
  interaction: 'none' | 'editable' | 'passive'
  isHighlighted: boolean
}

function PlacedPicture({ placement, patternId, turn, moonPhase, isDimmed, isStill, interaction, isHighlighted }: PlacedPictureProps) {
  const { pictureOf } = usePictures()
  const picture = pictureOf(placement.pictureId)
  // A scene saved with a picture that has since been deleted shows it as a single transparent pixel, which keeps the
  // hooks below in the same order whatever happens.
  const variant = picture ? findVariant(picture, placement.variant) : EMPTY_VARIANT
  const frameIndex = useCurrentFrame(variant, isStill)
  if (!picture) return null

  const frame = getFrameSprite(variant, frameIndex)
  const sprite = picture.isShadedByMoonPhase ? shadeMoon(frame, moonPhase) : frame
  const markingStyle: CSSProperties = {
    opacity: placement.opacity / 100,
    filter: isDimmed ? 'brightness(0.75)' : undefined,
    pointerEvents: interaction === 'passive' ? 'none' : undefined,
    ...(isHighlighted ? { outline: '3px dashed #ff2d95', outlineOffset: '-3px' } : {}),
  }
  const placementId = interaction === 'editable' ? placement.id : undefined

  if (placement.spread === 'screen') {
    return (
      <svg
        data-placement-id={placementId}
        viewBox={`0 0 ${sprite.rows[0].length} ${sprite.rows.length}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className="absolute inset-0 size-full"
        style={markingStyle}
      >
        <SpritePixels sprite={sprite} />
      </svg>
    )
  }
  if (placement.spread === 'across' || placement.spread === 'tile') {
    const position: CSSProperties =
      placement.spread === 'tile'
        ? { top: 0, height: '100%' }
        : { ...(placement.anchor === 'top' ? { top: `${placement.y}%` } : { bottom: `${placement.y}px` }), height: `${sprite.rows.length * placement.pixelSize}px` }
    return (
      <svg data-placement-id={placementId} shapeRendering="crispEdges" className="absolute inset-x-0 w-full" style={{ ...markingStyle, ...position }}>
        <defs>
          <pattern id={patternId} width={sprite.rows[0].length} height={sprite.rows.length} patternUnits="userSpaceOnUse" patternTransform={`scale(${placement.pixelSize})`}>
            <SpritePixels sprite={sprite} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    )
  }

  const motion = isStill ? 'none' : placement.motion
  const drift = DRIFT_SECONDS[turn % DRIFT_SECONDS.length]
  const flutter = FLUTTERS[turn % FLUTTERS.length]
  const motionStyle = (
    {
      none: {},
      // A drifting picture crosses from a fifth of the screen off its left edge to a tenth off its right, so it is at
      // `x` this far into a crossing.
      drift: { '--drift-duration': `${drift}s`, '--drift-delay': `${-((placement.x + 20) / 130) * drift}s` },
      hop: { '--hop-interval': `${HOP_SECONDS[turn % HOP_SECONDS.length]}s` },
      flutter: { '--flutter-duration': `${flutter.duration}s`, '--flutter-delay': `${flutter.delay}s` },
      wander: { '--wander-duration': `${WANDER_SECONDS[turn % WANDER_SECONDS.length]}s` },
    } as Record<string, Record<string, string>>
  )[motion]
  const verticalPosition: CSSProperties = placement.anchor === 'top' ? { top: `${placement.y}%` } : { bottom: `${placement.y}px` }

  return (
    <div
      data-placement-id={placementId}
      className={cn('absolute', { none: '', drift: 'animate-drift', hop: 'animate-hop', flutter: 'animate-flutter', wander: 'animate-wander' }[motion])}
      style={{ ...verticalPosition, left: motion === 'drift' ? 0 : `${placement.x}%`, ...markingStyle, ...motionStyle } as CSSProperties}
    >
      <div className={cn(placement.isFlipped && '-scale-x-100')}>
        <PixelSprite sprite={sprite} pixelSize={placement.pixelSize} />
      </div>
    </div>
  )
}

const EMPTY_VARIANT: ArtVariant = { name: '', palette: {}, frames: [{ rows: ['.'], milliseconds: 1000 }] }

/** The colour of the moon's unlit part, which is only just visible against the night sky. */
const MOON_SHADOW = '#4d4f7d'

/**
 * Shades the moon as it looks from the northern hemisphere, where it fills from the right as it waxes and empties
 * from the right as it wanes. This works for any drawing of the moon, as each row's pixels, from the first to the last
 * that isn't transparent, are taken as one slice across the disc.
 *
 * @param fullMoon The moon as it looks when it is full.
 * @param phase How far the moon is through its cycle (see Scene.moonPhase).
 * @returns The moon, with its sunlit part as drawn and the rest in shadow.
 */
function shadeMoon(fullMoon: Sprite, phase: number): Sprite {
  // Seen from Earth, the edge of the sunlit part crosses the disc as the cosine of the phase: at the right-hand rim
  // for a new moon, down the middle at a quarter, and at the left-hand rim for a full moon. Once the moon is waning,
  // the same edge is mirrored, and the sunlit part lies to its left.
  const isWaxing = phase < 0.5
  const litEdge = Math.cos(2 * Math.PI * phase) * (isWaxing ? 1 : -1)
  const { sprite: moon, key: shadow } = addColour(fullMoon, MOON_SHADOW)

  const rows = moon.rows.map((row) => {
    const firstPixel = row.search(/[^.]/)
    const lastPixel = row.length - 1 - [...row].reverse().join('').search(/[^.]/)
    const rowCentre = (firstPixel + lastPixel + 1) / 2
    const rowHalfWidth = (lastPixel - firstPixel + 1) / 2
    return [...row]
      .map((character, x) => {
        if (character === '.') return '.'
        // Where the middle of this pixel is across the disc: -1 at the left-hand rim and 1 at the right.
        const position = (x + 0.5 - rowCentre) / rowHalfWidth
        const isLit = isWaxing ? position > litEdge : position < litEdge
        return isLit ? character : shadow
      })
      .join('')
  })
  return { ...moon, rows }
}
