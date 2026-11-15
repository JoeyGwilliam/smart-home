/** Each drawn pixel of the grass, the animals and the rain is this many screen pixels across. */
export const SCENE_PIXEL_SIZE = 4

export const CREAM = '#fff8e7'
export const CHARCOAL = '#3d302c'

/**
 * A picture drawn as rows of pixels. Each character is one pixel, and stands for the colour that `palette` gives it.
 * A full stop is a transparent pixel. Every row must be the same length. A colour may be one that index.css changes
 * with the scene, such as "var(--cloud)".
 */
export interface Sprite {
  rows: string[]
  palette: Record<string, string>
}

/** Draws a sprite with crisp, square pixels, each `pixelSize` screen pixels across. */
export function PixelSprite({ sprite, pixelSize }: { sprite: Sprite; pixelSize: number }) {
  const width = sprite.rows[0].length
  const height = sprite.rows.length

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width * pixelSize} height={height * pixelSize} shapeRendering="crispEdges" className="block">
      <SpritePixels sprite={sprite} />
    </svg>
  )
}

/**
 * Draws a sprite's pixels, one unit across each, inside an SVG that the caller sizes, such as one that stretches the
 * sprite or repeats it as a pattern. The top-left pixel is at 0, 0.
 */
export function SpritePixels({ sprite }: { sprite: Sprite }) {
  // Each run of same-coloured pixels along a row is drawn as one rectangle, which keeps a big drawing, such as a
  // scene's sky, quick to draw.
  return sprite.rows.flatMap((row, y) =>
    [...row.matchAll(/([^.])\1*/g)].map((run) => (
      // The colour is a style rather than a fill attribute, as only styles understand index.css's var() colours.
      <rect key={`${run.index},${y}`} x={run.index} y={y} width={run[0].length} height="1" style={{ fill: sprite.palette[run[1]] }} />
    )),
  )
}
