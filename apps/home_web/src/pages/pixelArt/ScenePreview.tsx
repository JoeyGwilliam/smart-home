import { Monitor, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { SceneBackdrop } from '@/components/SceneBackdrop'
import { Button } from '@/components/ui/button'
import type { SceneWeather, TimeOfDay } from '@/scene/scene'
import type { ScenePlacement } from '@/scenes/sceneDesign'
import type { StackedLayer } from '@/scenes/useShownScene'
import { cn } from 'cn'

/** Which way up the screen is held. Pictures keep their size, but the screen's width and height trade places. */
export type Orientation = 'portrait' | 'landscape'

// The sizes of the screens that the preview shows a scene on, in screen pixels: a phone held upright, and a wide screen like the kiosk's.
const PREVIEW_SCREEN_SIZES: Record<Orientation, { width: number; height: number }> = {
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
}

/**
 * Keeps which orientation a preview shows. Most people look at the site held upright, so that is where it starts.
 *
 * @returns The orientation, and a function that changes it.
 */
export function usePreviewOrientation(): [Orientation, (orientation: Orientation) => void] {
  return useState<Orientation>('portrait')
}

/** Gives the height of the screen that the preview shows a scene on, in screen pixels. */
export function getPreviewScreenHeight(orientation: Orientation): number {
  return PREVIEW_SCREEN_SIZES[orientation].height
}

/** What can be done to the pictures of the layer being arranged, if there is one. */
interface Arranging {
  layerId: string
  selectedPlacementId: string | null
  /** Called with the placement that was pressed, or null when nothing in the layer was. */
  onSelect: (placementId: string | null) => void
  /**
   * Called as a placement is dragged, with where it now is. Every step of one drag shares a group, so that undoing it
   * puts the placement back where the drag began (see recordEdit).
   */
  onMove: (placementId: string, position: Pick<ScenePlacement, 'x' | 'y'>, group: string) => void
}

interface ScenePreviewProps {
  look: { timeOfDay: TimeOfDay; weather: SceneWeather }
  layers: StackedLayer[]
  moonPhase: number
  /** Which way up the screen is held, which the buttons above the preview change. */
  orientation: Orientation
  onOrientationChange: (orientation: Orientation) => void
  /** The layer whose pictures can be pressed and dragged, with everything else letting presses through. Left out, the preview just plays. */
  arranging?: Arranging
}

interface Drag {
  startClientX: number
  startClientY: number
  startPlacement: ScenePlacement
  /** Tells this drag apart from the others, for the group its steps share. */
  number: number
}

/**
 * A stack of layers as it looks on a landscape screen, scaled down to fit. While a layer is being arranged, everything
 * holds still, and only that layer's pictures can be pressed, to select one, and dragged, to move it.
 */
export function ScenePreview({ look, layers, moonPhase, orientation, onOrientationChange, arranging }: ScenePreviewProps) {
  const { width: screenWidth, height: screenHeight } = PREVIEW_SCREEN_SIZES[orientation]
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const dragRef = useRef<Drag | null>(null)
  const dragCountRef = useRef(0)
  const arrangedPlacements = layers.find((layer) => layer.id === arranging?.layerId)?.design.placements ?? []

  useEffect(() => {
    const box = boxRef.current
    // Some browsers, such as the one the tests run in, lay nothing out, so the preview keeps its first scale there.
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setScale(box.clientWidth / screenWidth))
    observer.observe(box)
    return () => observer.disconnect()
  }, [screenWidth])

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!arranging) return
    const placementId = (event.target as Element).closest('[data-placement-id]')?.getAttribute('data-placement-id') ?? null
    arranging.onSelect(placementId)
    const placement = arrangedPlacements.find((candidate) => candidate.id === placementId)
    // A picture spread over the whole screen, such as the sky, can be selected but has nowhere to move to.
    if (!placement || placement.spread === 'screen' || placement.spread === 'tile') return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragCountRef.current += 1
    dragRef.current = { startClientX: event.clientX, startClientY: event.clientY, startPlacement: placement, number: dragCountRef.current }
  }

  const continueDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || !arranging) return
    const across = (event.clientX - drag.startClientX) / scale
    const down = (event.clientY - drag.startClientY) / scale
    const { x, y, anchor } = drag.startPlacement
    const newX = x + (across / screenWidth) * 100
    // From the top, y is a percentage of the height, and grows downwards. From the bottom, it is in screen pixels, and
    // grows upwards.
    const newY = anchor === 'top' ? y + (down / screenHeight) * 100 : y - down
    arranging.onMove(drag.startPlacement.id, { x: roundToTenth(newX), y: roundToTenth(newY) }, `move-${drag.number}`)
  }

  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div className="grid gap-2">
      <div role="group" aria-label="Preview orientation" className="flex gap-2">
        {(['portrait', 'landscape'] as const).map((choice) => (
          <Button key={choice} variant={orientation === choice ? 'default' : 'outline'} aria-pressed={orientation === choice} onClick={() => onOrientationChange(choice)} className="h-9 rounded-full px-4 font-bold capitalize">
            {choice === 'portrait' ? <Smartphone /> : <Monitor />}
            {choice}
          </Button>
        ))}
      </div>
      <div
        ref={boxRef}
        style={{ aspectRatio: `${screenWidth} / ${screenHeight}` }}
        className={cn('relative w-full overflow-hidden rounded-2xl border-[3px] border-panel-edge shadow-inner', orientation === 'portrait' && 'mx-auto max-w-sm')}
      >
      <div
        role="img"
        aria-label="Preview"
        className="relative origin-top-left touch-none select-none"
        style={{ width: screenWidth, height: screenHeight, transform: `scale(${scale})` }}
        onPointerDown={startDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <SceneBackdrop
          look={look}
          layers={layers}
          moonPhase={moonPhase}
          isStill={arranging !== undefined}
          editableLayerId={arranging?.layerId}
          highlightedPlacementId={arranging?.selectedPlacementId}
          className={arranging ? 'absolute inset-0 cursor-move' : 'absolute inset-0'}
        />
      </div>
      </div>
    </div>
  )
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
}
