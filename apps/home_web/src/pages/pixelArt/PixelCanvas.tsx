import { useRef, type PointerEvent } from 'react'

import { SpritePixels, type Sprite } from '@/components/PixelSprite'

interface PixelCanvasProps {
  drawing: Sprite
  /**
   * Called for each pixel that a press or a drag passes over, once per pixel per stroke. A stroke runs from pressing
   * down to letting go, and every pixel in it shares the stroke's id.
   */
  onPaint: (x: number, y: number, stroke: { id: number; isStart: boolean }) => void
}

/**
 * The drawing, enlarged, with a grid over its pixels and a chequered board showing through the transparent ones. It
 * fits the space it is given, keeping its shape. Pressing and dragging, with a finger or a mouse, paints.
 */
export function PixelCanvas({ drawing, onPaint }: PixelCanvasProps) {
  const width = drawing.rows[0].length
  const height = drawing.rows.length
  const strokeRef = useRef({ id: 0, isDrawing: false, lastPixel: '' })

  const paintAt = (event: PointerEvent<SVGSVGElement>, isStart: boolean) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * width)
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * height)
    const pixel = `${x},${y}`
    if (x < 0 || x >= width || y < 0 || y >= height || (!isStart && pixel === strokeRef.current.lastPixel)) return
    strokeRef.current.lastPixel = pixel
    onPaint(x, y, { id: strokeRef.current.id, isStart })
  }

  const gridLines = [
    ...Array.from({ length: width - 1 }, (_, index) => `M${index + 1} 0V${height}`),
    ...Array.from({ length: height - 1 }, (_, index) => `M0 ${index + 1}H${width}`),
  ].join('')

  return (
    // Tall drawings are kept short enough to fit on the screen, and wide ones narrow enough to fit across it.
    <div className="mx-auto w-full" style={{ maxWidth: `min(100%, calc(60vh * ${width / height}))` }}>
      <svg
        role="img"
        aria-label={`Drawing area, ${width} by ${height} pixels`}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="crispEdges"
        className="block w-full cursor-crosshair touch-none rounded-md border-2 border-panel-edge select-none"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={(event) => {
          // Keeps the drag's events coming here even once the pointer leaves the drawing, so that the stroke ends when
          // the pointer is let go wherever that is.
          event.currentTarget.setPointerCapture?.(event.pointerId)
          strokeRef.current = { id: strokeRef.current.id + 1, isDrawing: true, lastPixel: '' }
          paintAt(event, true)
        }}
        onPointerMove={(event) => strokeRef.current.isDrawing && paintAt(event, false)}
        onPointerUp={() => {
          strokeRef.current.isDrawing = false
        }}
        onPointerCancel={() => {
          strokeRef.current.isDrawing = false
        }}
      >
        <defs>
          <pattern id="transparent-chequers" width="1" height="1" patternUnits="userSpaceOnUse">
            <rect width="1" height="1" fill="#ffffff" />
            <rect width="0.5" height="0.5" fill="#d9d9d9" />
            <rect x="0.5" y="0.5" width="0.5" height="0.5" fill="#d9d9d9" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#transparent-chequers)" />
        <SpritePixels sprite={drawing} />
        <path d={gridLines} stroke="#00000033" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
      </svg>
    </div>
  )
}
