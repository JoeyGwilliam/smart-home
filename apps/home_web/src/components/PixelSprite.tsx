/** Each drawn pixel of the grass, the animals and the rain is this many screen pixels across. */
export const SCENE_PIXEL_SIZE = 4

export const CREAM = '#fff8e7'
export const CHARCOAL = '#3d302c'

/**
 * A picture drawn as rows of pixels. Each character is one pixel, and stands for the colour that `palette` gives it.
 * A full stop is a transparent pixel. Every row must be the same length.
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
      {sprite.rows.flatMap((row, y) =>
        [...row].map((character, x) =>
          character === '.' ? null : <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={sprite.palette[character]} />,
        ),
      )}
    </svg>
  )
}
