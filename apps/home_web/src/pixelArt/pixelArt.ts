import type { Sprite } from '@/components/PixelSprite'

// Pictures are arranged as sprite editors and game engines arrange theirs. A picture is one thing that scenes are made
// of, such as a cow, an umbrella or the rain. It has variants, the ways it can look, such as the cow's poses or the
// umbrella's colours. Each variant is a strip of frames, which show one after another, over and over; a still variant
// has one frame. Layers place pictures and know nothing else about them (see SceneDesign), and pictures know nothing
// of each other. The pixel art API owns the rules for a valid picture.

/** One thing that scenes are made of, in every way it can look. */
export interface PixelArt {
  /**
   * Names the picture to the pixel art API, which keeps a redrawing under it, and to the scenes that place it. It must
   * never change, or both would lose it. Lower-case letters, digits and hyphens only.
   */
  id: string
  /** What the picture is, such as "Cow", for the pixel art page. */
  title: string
  /** What kind of thing the picture is, such as "Sky", which the pixel art page groups pictures by. */
  group: string
  /** The ways the picture can look. There is at least one, and their names all differ. The first is the usual one. */
  variants: ArtVariant[]
  /** Whether the picture is shaded to match the moon's phase, whatever is drawn. */
  isShadedByMoonPhase?: boolean
}

/** One way a picture can look: a strip of frames in the colours of one palette. */
export interface ArtVariant {
  /** Tells the variant apart from the picture's others, such as "Sleeping". At most 40 characters. */
  name: string
  /** The colour that each character in the frames stands for (see Sprite). */
  palette: Record<string, string>
  /** The drawings, in the order they show. There is at least one, and they are all the same size. */
  frames: ArtFrame[]
}

/** One drawing in a variant's strip. */
export interface ArtFrame {
  /** The pixels (see Sprite). */
  rows: string[]
  /** How long the frame shows before the next, from 20 to 60000. A variant with one frame ignores it. */
  milliseconds: number
}

/** How long a frame shows unless it is given a time of its own. */
export const DEFAULT_FRAME_MILLISECONDS = 200

/**
 * Makes a variant that doesn't move, from a single drawing.
 *
 * @param name The variant's name.
 * @param rows The drawing's pixels.
 * @param palette The colour that each character stands for.
 * @returns The variant, with the drawing as its only frame.
 */
export function createStillVariant(name: string, rows: string[], palette: Record<string, string>): ArtVariant {
  return { name, palette, frames: [{ rows, milliseconds: DEFAULT_FRAME_MILLISECONDS }] }
}

/**
 * Finds the variant of a picture that a placement asks for.
 *
 * @param art The picture.
 * @param variantName The variant's name.
 * @returns The variant of that name, or the picture's first variant if it has none of that name, so that renaming or
 *   deleting a variant never leaves a placement with nothing to show.
 */
export function findVariant(art: PixelArt, variantName: string): ArtVariant {
  return art.variants.find((variant) => variant.name === variantName) ?? art.variants[0]
}

/**
 * Gives one frame of a variant as a drawing that can be shown or edited.
 *
 * @param variant The variant.
 * @param frameIndex Which frame, counting from 0. A number past the last frame gives the last.
 * @returns The frame's pixels, with the variant's palette.
 */
export function getFrameSprite(variant: ArtVariant, frameIndex: number): Sprite {
  const frame = variant.frames[Math.min(frameIndex, variant.frames.length - 1)]
  return { rows: frame.rows, palette: variant.palette }
}

/**
 * Finds which frame of a variant shows at a moment. Every placement of a variant works this out from the same clock,
 * so that they all keep in step, such as the tiles of the rain.
 *
 * @param variant The variant.
 * @param milliseconds The moment, as milliseconds since any fixed time, such as Date.now().
 * @returns Which frame shows, counting from 0, and how many milliseconds are left until the next one.
 */
export function findFrameAt(variant: ArtVariant, milliseconds: number): { frameIndex: number; millisecondsLeft: number } {
  const loopLength = variant.frames.reduce((total, frame) => total + frame.milliseconds, 0)
  let timeIntoLoop = ((milliseconds % loopLength) + loopLength) % loopLength
  for (const [frameIndex, frame] of variant.frames.entries()) {
    if (timeIntoLoop < frame.milliseconds) return { frameIndex, millisecondsLeft: frame.milliseconds - timeIntoLoop }
    timeIntoLoop -= frame.milliseconds
  }
  return { frameIndex: 0, millisecondsLeft: variant.frames[0].milliseconds }
}

/**
 * Chooses the frame of a variant to show while everything holds still, such as on the pixel art page: the one with the
 * most drawn on it, so that something that blinks or flashes can still be seen and pressed.
 *
 * @returns The frame's index, counting from 0.
 */
export function findStillFrame(variant: ArtVariant): number {
  const countPixels = (frame: ArtFrame) => frame.rows.join('').replaceAll('.', '').length
  return variant.frames.reduce((busiest, frame, index) => (countPixels(frame) > countPixels(variant.frames[busiest]) ? index : busiest), 0)
}
