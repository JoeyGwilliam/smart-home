import { Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { Sprite } from '@/components/PixelSprite'
import { cn } from 'cn'

/** The colour that a colour picker starts at for a colour it can't show, such as one that changes with the sky. */
const FALLBACK_PICKER_COLOUR = '#ffffff'

interface ColourPaletteProps {
  drawing: Sprite
  /** What some of the palette's characters mean, such as that a colour changes with the sky, keyed by character. */
  colourNames: Record<string, string>
  /** The palette's character for the colour being painted with, or undefined if the palette is empty. */
  chosenKey: string | undefined
  onChoose: (key: string) => void
  /** Called with a colour that has been picked to paint with, once the person has finished picking it. */
  onAdd: (colour: string) => void
  /** Called with each new colour for the chosen one, as the person moves through the colour picker. */
  onChange: (key: string, colour: string) => void
}

/**
 * The drawing's colours, one of which is chosen to paint with, and ways to add a colour and change the chosen one.
 * Changing a colour recolours every pixel painted in it.
 */
export function ColourPalette({ drawing, colourNames, chosenKey, onChoose, onAdd, onChange }: ColourPaletteProps) {
  const chosenColour = chosenKey === undefined ? undefined : drawing.palette[chosenKey]

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Colours">
        {Object.entries(drawing.palette).map(([key, colour]) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === chosenKey}
            aria-label={colourNames[key] ?? `Colour ${colour}`}
            title={colourNames[key] ?? colour}
            onClick={() => onChoose(key)}
            className={cn(
              'size-10 rounded-lg border-2 border-panel-edge shadow-sm transition-transform',
              key === chosenKey && 'scale-110 ring-3 ring-primary ring-offset-2 ring-offset-background',
            )}
            style={{ background: colour }}
          />
        ))}
        <AddColourButton onAdd={onAdd} />
      </div>
      {chosenKey !== undefined && chosenColour !== undefined && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 font-semibold">
            Change this colour
            <input
              type="color"
              className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent"
              value={isPickerColour(chosenColour) ? chosenColour.toLowerCase() : FALLBACK_PICKER_COLOUR}
              onChange={(event) => onChange(chosenKey, event.target.value)}
            />
          </label>
          {colourNames[chosenKey] && <span className="text-muted-foreground">{colourNames[chosenKey]}</span>}
        </div>
      )}
    </div>
  )
}

/**
 * Opens a colour picker for a colour to add. React reports every colour that the picker passes through, which would
 * add each of them, so this listens for the browser's own change event instead, which comes once the picking is done.
 */
function AddColourButton({ onAdd }: { onAdd: (colour: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onAddRef = useRef(onAdd)
  useEffect(() => {
    onAddRef.current = onAdd
  })

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const addPickedColour = () => onAddRef.current(input.value)
    input.addEventListener('change', addPickedColour)
    return () => input.removeEventListener('change', addPickedColour)
  }, [])

  return (
    <label
      title="Add a colour"
      className="relative grid size-10 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-panel-edge text-muted-foreground hover:bg-muted"
    >
      <Plus className="size-5" />
      <input ref={inputRef} type="color" aria-label="Add a colour" defaultValue="#000000" className="absolute inset-0 size-full cursor-pointer opacity-0" />
    </label>
  )
}

function isPickerColour(colour: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(colour)
}
