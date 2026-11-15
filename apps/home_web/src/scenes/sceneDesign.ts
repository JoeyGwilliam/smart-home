import type { SceneWeather, TimeOfDay } from '@/scene/scene'

// The backdrop is built up in three levels, each made of the one below. Pictures are drawn pixel by pixel (see PixelArt).
// Layers place pictures on the screen, such as "Animals by day" or "Rain". Scenes stack layers up, back first, such as a
// rainy day: the sky, grey clouds, the grass, puddles, the animals, their umbrellas and the rain. A layer can be used by
// any number of scenes, and nothing in a layer knows anything about any other layer, so each can be changed on its own.
// The pixel art API owns the rules for a valid design.

/** What the backdrop shows: a stack of layers, and the colours to show them in. */
export interface SceneDesign {
  /** What the scene is called, such as "Day, rain" or "Christmas". */
  name: string
  /**
   * The time of day and weather whose colours the scene takes: those of the pages over it, and of every colour in it
   * that changes with the sky, such as "var(--grass)". At night, the pages are dark.
   */
  look: { timeOfDay: TimeOfDay; weather: SceneWeather }
  /**
   * The ids of the layers in the scene, back first: each is drawn over the ones before it. Each is used only once. A
   * layer that has since been deleted is left out.
   */
  layerIds: string[]
}

/** A named group of placed pictures, which scenes stack up. */
export interface LayerDesign {
  /** What the layer is called, such as "Animals by day". */
  name: string
  /** The pictures in the layer, each drawn over the ones before it. Their ids are all different. */
  placements: ScenePlacement[]
}

export type PlacementSpread = 'none' | 'across' | 'tile' | 'screen'
export type PlacementMotion = 'none' | 'drift' | 'hop' | 'flutter' | 'wander'

/** A picture (see PixelArt), placed in a layer. */
export interface ScenePlacement {
  /** Tells the placement apart from the others in its layer. Lower-case letters, digits and hyphens. */
  id: string
  /** The id of the picture to show (see PixelArt.id). */
  pictureId: string
  /** The name of the picture's variant to show, such as "Sleeping". The picture's first variant shows if it has none of this name. */
  variant: string
  /** How far across the screen the picture's left edge is, as a percentage of its width, from -50 to 150. */
  x: number
  /** Which edge of the screen `y` counts from: the top for things in the sky, the bottom for things on the ground. */
  anchor: 'top' | 'bottom'
  /**
   * From the top: how far down the picture's top edge is, as a percentage of the screen's height, from -50 to 150.
   * From the bottom: how far up its bottom edge is, in screen pixels, from -500 to 2000. Things on the ground are
   * placed in screen pixels, so that they stand on the grass, which is a set number of screen pixels tall, on any
   * screen.
   */
  y: number
  /** How many screen pixels across each of the picture's pixels is drawn, from 1 to 32. */
  pixelSize: number
  /**
   * How the picture covers the screen: once ("none"), repeated along the width at its height ("across"), like the
   * grass, repeated across and down ("tile"), like the rain, or stretched over all of it ("screen"), like the sky.
   * Only a picture that isn't spread uses `x`; only one that is placed once or across uses `y`.
   */
  spread: PlacementSpread
  /** How solid the picture is, from 0 for invisible to 100 for solid, so that it can be laid over others like a veil. */
  opacity: number
  /** Whether the picture faces the other way. Pictures are drawn facing right. */
  isFlipped: boolean
  /**
   * How the placement moves about, on top of its variant's own frames. A drifting picture crosses the screen over and
   * over, and is at `x` when it first shows.
   */
  motion: PlacementMotion
}
