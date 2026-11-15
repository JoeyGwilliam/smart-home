import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CopyPlus, Trash2 } from 'lucide-react'

import { PixelSprite, type Sprite } from '@/components/PixelSprite'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_FRAMES } from '@/pixelArt/editPicture'
import { getFrameSprite, type ArtVariant } from '@/pixelArt/pixelArt'
import { useCurrentFrame } from '@/pixelArt/useCurrentFrame'
import { cn } from 'cn'

/** How many screen pixels the longer side of each frame's thumbnail takes up. */
const THUMBNAIL_SIZE = 40

interface FrameStripProps {
  variant: ArtVariant
  chosenFrameIndex: number
  onChoose: (frameIndex: number) => void
  /** Called to add a copy of the chosen frame straight after it. */
  onAdd: () => void
  onRemove: () => void
  /** Called with how long the chosen frame should show, in milliseconds. */
  onChangeTime: (milliseconds: number) => void
  /** Called to slide the chosen frame's pixels, with what leaves one edge coming back in at the other (see shiftSprite). */
  onSlide: (across: number, down: number) => void
}

/**
 * A variant's frames, in the order they play, with the variant playing beside them as it does on the site. A frame can
 * be chosen to draw on, copied to make the next step of a movement, slid a pixel at a time, timed, or taken away.
 */
export function FrameStrip({ variant, chosenFrameIndex, onChoose, onAdd, onRemove, onChangeTime, onSlide }: FrameStripProps) {
  const playingFrameIndex = useCurrentFrame(variant, false)
  const chosenFrame = variant.frames[chosenFrameIndex]

  return (
    <section aria-label="Frames" className="grid gap-3 rounded-2xl bg-field/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{variant.frames.length === 1 ? 'One frame: stands still' : `${variant.frames.length} frames, playing in turn`}</h3>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" disabled={variant.frames.length >= MAX_FRAMES} onClick={onAdd} className="h-9 rounded-full px-3 font-bold">
            <CopyPlus />
            Copy this frame
          </Button>
          <Button variant="outline" disabled={variant.frames.length <= 1} onClick={onRemove} className="h-9 rounded-full px-3 font-bold">
            <Trash2 />
            Remove this frame
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose a frame">
          {variant.frames.map((_, frameIndex) => (
            <button
              key={frameIndex}
              type="button"
              aria-pressed={frameIndex === chosenFrameIndex}
              aria-label={`Frame ${frameIndex + 1}`}
              onClick={() => onChoose(frameIndex)}
              className={cn(
                'grid size-14 shrink-0 place-items-center rounded-lg border-2 border-transparent bg-card',
                frameIndex === chosenFrameIndex && 'border-primary',
                frameIndex === playingFrameIndex && variant.frames.length > 1 && 'ring-2 ring-secondary',
              )}
            >
              <Thumbnail sprite={getFrameSprite(variant, frameIndex)} />
            </button>
          ))}
        </div>
        <div className="grid justify-items-center gap-1 text-xs text-muted-foreground">
          <div className="grid size-14 place-items-center rounded-lg bg-card">
            <Thumbnail sprite={getFrameSprite(variant, playingFrameIndex)} />
          </div>
          Playing
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        {variant.frames.length > 1 && (
          <label className="flex items-center gap-2">
            Frame {chosenFrameIndex + 1} shows for
            <Input
              type="number"
              min={20}
              max={60000}
              step={10}
              key={`${chosenFrameIndex}-${chosenFrame.milliseconds}`}
              defaultValue={chosenFrame.milliseconds}
              onBlur={(event) => Number(event.target.value) !== chosenFrame.milliseconds && onChangeTime(Number(event.target.value))}
              onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
              className="h-9 w-24 bg-card"
            />
            milliseconds
          </label>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Slide this frame">
          Slide
          <Button variant="outline" size="icon" aria-label="Slide left" onClick={() => onSlide(-1, 0)} className="rounded-full">
            <ArrowLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="Slide up" onClick={() => onSlide(0, -1)} className="rounded-full">
            <ArrowUp />
          </Button>
          <Button variant="outline" size="icon" aria-label="Slide down" onClick={() => onSlide(0, 1)} className="rounded-full">
            <ArrowDown />
          </Button>
          <Button variant="outline" size="icon" aria-label="Slide right" onClick={() => onSlide(1, 0)} className="rounded-full">
            <ArrowRight />
          </Button>
        </div>
      </div>
    </section>
  )
}

function Thumbnail({ sprite }: { sprite: Sprite }) {
  return <PixelSprite sprite={sprite} pixelSize={THUMBNAIL_SIZE / Math.max(sprite.rows.length, sprite.rows[0].length)} />
}
