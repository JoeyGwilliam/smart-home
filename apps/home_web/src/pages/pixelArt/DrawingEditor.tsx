import { Eraser, Grid2x2Plus, Minus, PaintBucket, Pencil, Plus, Square, Undo2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import type { Sprite } from '@/components/PixelSprite'
import { Button } from '@/components/ui/button'
import { ColourPalette } from '@/pages/pixelArt/ColourPalette'
import { PixelCanvas } from '@/pages/pixelArt/PixelCanvas'
import { addColour, changeColour, clearSprite, doubleSprite, fillArea, MAX_SIDE_PIXELS, paintPixel, resizeSprite, TRANSPARENT } from '@/pixelArt/editSprite'

type Tool = 'pencil' | 'eraser' | 'fill'

const TOOLS: { tool: Tool; label: string; icon: LucideIcon }[] = [
  { tool: 'pencil', label: 'Pencil', icon: Pencil },
  { tool: 'eraser', label: 'Rubber', icon: Eraser },
  { tool: 'fill', label: 'Fill', icon: PaintBucket },
]

interface DrawingEditorProps {
  drawing: Sprite
  /** What some of the palette's characters mean, such as that a colour changes with the sky, keyed by character. */
  colourNames: Record<string, string>
  /**
   * Called with each edit, which is given the drawing as it is at that moment, as a drag can paint several pixels
   * before the page next draws itself. Edits sharing a group are undone together (see recordEdit).
   */
  onEdit: (change: (drawing: Sprite) => Sprite, group?: string) => void
  canUndo: boolean
  onUndo: () => void
}

/**
 * The tools for drawing a picture pixel by pixel: a pencil, a rubber and a fill, the drawing's colours, the drawing
 * itself, enlarged, and its size. Give it a new key for each drawing, so that each starts with the pencil and its own
 * first colour.
 */
export function DrawingEditor({ drawing, colourNames, onEdit, canUndo, onUndo }: DrawingEditorProps) {
  const [tool, setTool] = useState<Tool>('pencil')
  const [chosenKey, setChosenKey] = useState<string | undefined>(undefined)
  const paintKey = chosenKey !== undefined && chosenKey in drawing.palette ? chosenKey : Object.keys(drawing.palette)[0]
  const width = drawing.rows[0].length
  const height = drawing.rows.length

  const paint = (x: number, y: number, stroke: { id: number; isStart: boolean }) => {
    if (tool === 'fill') {
      if (stroke.isStart && paintKey !== undefined) onEdit((current) => fillArea(current, x, y, paintKey))
      return
    }
    const key = tool === 'eraser' ? TRANSPARENT : paintKey
    if (key !== undefined) onEdit((current) => paintPixel(current, x, y, key), `stroke-${stroke.id}`)
  }

  const addPickedColour = (colour: string) => {
    // Nothing can paint while a colour is being picked, so the drawing as it is now is the one the colour is added to.
    const { sprite, key } = addColour(drawing, colour)
    onEdit(() => sprite)
    setChosenKey(key)
    setTool((currentTool) => (currentTool === 'eraser' ? 'pencil' : currentTool))
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-field p-1" role="group" aria-label="Tools">
          {TOOLS.map(({ tool: toolOption, label, icon: Icon }) => (
            <Button
              key={toolOption}
              variant={tool === toolOption ? 'default' : 'ghost'}
              aria-pressed={tool === toolOption}
              onClick={() => setTool(toolOption)}
              className="h-10 rounded-full px-4 font-bold"
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={() => onEdit(clearSprite)} className="h-10 rounded-full px-4 font-bold">
          <Square />
          Clear
        </Button>
        <Button variant="outline" disabled={!canUndo} onClick={onUndo} className="h-10 rounded-full px-4 font-bold">
          <Undo2 />
          Undo
        </Button>
      </div>

      <ColourPalette
        drawing={drawing}
        colourNames={colourNames}
        chosenKey={paintKey}
        onChoose={(key) => {
          setChosenKey(key)
          if (tool === 'eraser') setTool('pencil')
        }}
        onAdd={addPickedColour}
        onChange={(key, colour) => onEdit((current) => changeColour(current, key, colour), `colour-${key}`)}
      />

      <PixelCanvas drawing={drawing} onPaint={paint} />

      <div className="flex flex-wrap items-center gap-4">
        <SizeStepper
          label="Width"
          shrinkLabel="Make narrower"
          growLabel="Make wider"
          value={width}
          onChange={(newWidth) => onEdit((current) => resizeSprite(current, newWidth, current.rows.length))}
        />
        <SizeStepper
          label="Height"
          shrinkLabel="Make shorter"
          growLabel="Make taller"
          value={height}
          onChange={(newHeight) => onEdit((current) => resizeSprite(current, current.rows[0].length, newHeight))}
        />
        <Button
          variant="outline"
          disabled={width * 2 > MAX_SIDE_PIXELS || height * 2 > MAX_SIDE_PIXELS}
          onClick={() => onEdit(doubleSprite)}
          className="h-10 rounded-full px-4 font-bold"
        >
          <Grid2x2Plus />
          Double the detail
        </Button>
      </div>
    </div>
  )
}

interface SizeStepperProps {
  label: string
  /** Names the button that takes a pixel off, such as "Make narrower". */
  shrinkLabel: string
  /** Names the button that adds a pixel, such as "Make wider". */
  growLabel: string
  value: number
  onChange: (value: number) => void
}

/** Makes the drawing a pixel bigger or smaller along one side. New pixels are transparent, on the right or at the bottom. */
function SizeStepper({ label, shrinkLabel, growLabel, value, onChange }: SizeStepperProps) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold" role="group" aria-label={label}>
      <span className="w-12">{label}</span>
      <Button variant="outline" size="icon-lg" className="rounded-full" aria-label={shrinkLabel} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <Minus />
      </Button>
      <span className="w-8 text-center text-base tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        variant="outline"
        size="icon-lg"
        className="rounded-full"
        aria-label={growLabel}
        disabled={value >= MAX_SIDE_PIXELS}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}
