import type { Sprite } from '@/components/PixelSprite'
import { DEFAULT_FRAME_MILLISECONDS, getFrameSprite, type ArtVariant } from '@/pixelArt/pixelArt'

// Every function here works on a picture's variants, and gives a changed copy of them, leaving the ones it was given
// as they were. The limits are the pixel art API's, so that whatever the pixel art page makes can be saved.

export const MAX_VARIANTS = 32
export const MAX_FRAMES = 64
const MAX_NAME_LENGTH = 40

/**
 * Redraws one frame. A change to the palette recolours every frame of the variant, as they share it. A change to the
 * frame's size is made to every frame of the variant in the same way, as they must stay the same size.
 *
 * @param variants The picture's variants.
 * @param variantIndex Which variant, counting from 0.
 * @param frameIndex Which of its frames, counting from 0.
 * @param change Gives the drawing as it should be, from the drawing as it is, such as painting a pixel or resizing it.
 * @returns The changed variants.
 */
export function editFrame(variants: ArtVariant[], variantIndex: number, frameIndex: number, change: (drawing: Sprite) => Sprite): ArtVariant[] {
  return changeVariant(variants, variantIndex, (variant) => {
    const before = getFrameSprite(variant, frameIndex)
    const after = change(before)
    const isResized = after.rows.length !== before.rows.length || after.rows[0].length !== before.rows[0].length
    const frames = variant.frames.map((frame, index) => {
      if (index === frameIndex) return { ...frame, rows: after.rows }
      return isResized ? { ...frame, rows: change({ rows: frame.rows, palette: variant.palette }).rows } : frame
    })
    return { ...variant, palette: after.palette, frames }
  })
}

/**
 * Adds a variant, as a copy of another, straight after it, for drawing a new pose or colour from. Does nothing if the
 * picture already has as many variants as it can.
 *
 * @param variants The picture's variants.
 * @param sourceIndex Which variant to copy, counting from 0.
 * @returns The changed variants. The new variant is named after the one it copies, with a number to tell it apart.
 */
export function addVariant(variants: ArtVariant[], sourceIndex: number): ArtVariant[] {
  if (variants.length >= MAX_VARIANTS) return variants
  const source = variants[sourceIndex]
  const takenNames = new Set(variants.map((variant) => variant.name))
  let number = 2
  while (takenNames.has(`${source.name} ${number}`.slice(-MAX_NAME_LENGTH))) number += 1
  const copy = { ...source, name: `${source.name} ${number}`.slice(-MAX_NAME_LENGTH) }
  return [...variants.slice(0, sourceIndex + 1), copy, ...variants.slice(sourceIndex + 1)]
}

/**
 * Renames a variant. Does nothing if the name is blank, too long, or already another variant's, as placements find
 * variants by name.
 *
 * @returns The changed variants.
 */
export function renameVariant(variants: ArtVariant[], variantIndex: number, name: string): ArtVariant[] {
  const trimmedName = name.trim()
  const isTaken = variants.some((variant, index) => index !== variantIndex && variant.name === trimmedName)
  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH || isTaken) return variants
  return changeVariant(variants, variantIndex, (variant) => ({ ...variant, name: trimmedName }))
}

/**
 * Takes a variant away. Does nothing if it is the picture's only one.
 *
 * @returns The changed variants.
 */
export function removeVariant(variants: ArtVariant[], variantIndex: number): ArtVariant[] {
  return variants.length > 1 ? variants.filter((_, index) => index !== variantIndex) : variants
}

/**
 * Adds a frame to a variant, as a copy of another, straight after it, for drawing the next step of a movement from.
 * Does nothing if the variant already has as many frames as it can.
 *
 * @returns The changed variants.
 */
export function addFrame(variants: ArtVariant[], variantIndex: number, sourceFrameIndex: number): ArtVariant[] {
  return changeVariant(variants, variantIndex, (variant) => {
    if (variant.frames.length >= MAX_FRAMES) return variant
    const frames = [...variant.frames.slice(0, sourceFrameIndex + 1), variant.frames[sourceFrameIndex], ...variant.frames.slice(sourceFrameIndex + 1)]
    return { ...variant, frames }
  })
}

/**
 * Takes a frame away. Does nothing if it is the variant's only one.
 *
 * @returns The changed variants.
 */
export function removeFrame(variants: ArtVariant[], variantIndex: number, frameIndex: number): ArtVariant[] {
  return changeVariant(variants, variantIndex, (variant) =>
    variant.frames.length > 1 ? { ...variant, frames: variant.frames.filter((_, index) => index !== frameIndex) } : variant,
  )
}

/**
 * Sets how long a frame shows, keeping it between 20 and 60000 milliseconds.
 *
 * @returns The changed variants.
 */
export function changeFrameTime(variants: ArtVariant[], variantIndex: number, frameIndex: number, milliseconds: number): ArtVariant[] {
  const time = Math.min(Math.max(Math.round(milliseconds) || DEFAULT_FRAME_MILLISECONDS, 20), 60_000)
  return changeVariant(variants, variantIndex, (variant) => ({
    ...variant,
    frames: variant.frames.map((frame, index) => (index === frameIndex ? { ...frame, milliseconds: time } : frame)),
  }))
}

/**
 * Tells whether two sets of variants look and move the same.
 *
 * @returns Whether they are the same.
 */
export function isSameVariants(first: ArtVariant[], second: ArtVariant[]): boolean {
  const describe = (variants: ArtVariant[]) =>
    JSON.stringify(variants.map((variant) => [variant.name, Object.entries(variant.palette).sort(), variant.frames.map((frame) => [frame.rows, frame.milliseconds])]))
  return describe(first) === describe(second)
}

function changeVariant(variants: ArtVariant[], variantIndex: number, change: (variant: ArtVariant) => ArtVariant): ArtVariant[] {
  return variants.map((variant, index) => (index === variantIndex ? change(variant) : variant))
}
