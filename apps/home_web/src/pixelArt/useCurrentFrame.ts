import { useEffect, useState } from 'react'

import { findFrameAt, findStillFrame, type ArtVariant } from '@/pixelArt/pixelArt'

/**
 * Follows which frame of a variant shows now, stepping to the next as each frame's time runs out. People who ask their
 * device for less motion see one frame that stands still, as everyone does while the backdrop is held still.
 *
 * @returns The frame's index, counting from 0.
 */
export function useCurrentFrame(variant: ArtVariant, isStill: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  const prefersReducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isAnimated = !isStill && !prefersReducedMotion && variant.frames.length > 1
  const { frameIndex, millisecondsLeft } = findFrameAt(variant, now)

  useEffect(() => {
    if (!isAnimated) return
    const timer = setTimeout(() => setNow(Date.now()), millisecondsLeft)
    return () => clearTimeout(timer)
  }, [isAnimated, millisecondsLeft, now])

  return isAnimated ? frameIndex : findStillFrame(variant)
}
