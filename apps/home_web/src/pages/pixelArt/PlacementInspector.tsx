import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PictureSelect } from '@/pages/pixelArt/PictureSelect'
import { findVariant } from '@/pixelArt/pixelArt'
import { usePictures } from '@/pixelArt/usePictures'
import type { PlacementMotion, PlacementSpread, ScenePlacement } from '@/scenes/sceneDesign'

const SPREAD_NAMES: Record<PlacementSpread, string> = {
  none: 'Once, where it is placed',
  across: 'Repeated across the screen, like the grass',
  tile: 'Repeated all over the screen, like faint stars',
  screen: 'Stretched over the whole screen, like the sky',
}

const MOTION_NAMES: Record<PlacementMotion, string> = {
  none: 'Stays where it is',
  drift: 'Drifts across the sky',
  hop: 'Hops now and then',
  flutter: 'Flutters in loops',
  wander: 'Wanders a little',
}

interface PlacementInspectorProps {
  placement: ScenePlacement
  /** Called with details to change, and a group that a run of changes to the same detail shares (see recordEdit). */
  onChange: (changes: Partial<Omit<ScenePlacement, 'id'>>, group?: string) => void
  /** Called to count the placement's height from the other edge of the screen, keeping it where it is. */
  onChangeAnchor: (anchor: 'top' | 'bottom') => void
}

/**
 * Every detail of one placed picture: which picture and variant it is, how it covers the screen, where, how big and how
 * solid it is, and how it moves about. Only the details that matter for how it is spread are offered. How it looks,
 * frames and colours and all, belongs to its variant, which is drawn on the Pictures tab.
 */
export function PlacementInspector({ placement, onChange, onChangeAnchor }: PlacementInspectorProps) {
  const { pictureOf } = usePictures()
  const picture = pictureOf(placement.pictureId)
  const isPlacedOnce = placement.spread === 'none'
  const hasHeight = placement.spread === 'none' || placement.spread === 'across'

  return (
    <section aria-label="Selected picture" className="grid gap-4 rounded-2xl bg-field/70 p-4">
      <h3 className="text-lg font-semibold">{picture?.title ?? 'A picture that has been deleted'}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Picture">
          <PictureSelect value={placement.pictureId} onChange={(pictureId) => onChange({ pictureId, variant: pictureOf(pictureId)?.variants[0].name ?? '' })} />
        </Field>

        {picture && picture.variants.length > 1 && (
          <Field label="Variant">
            <select className={SELECT_CLASS_NAME} value={findVariant(picture, placement.variant).name} onChange={(event) => onChange({ variant: event.target.value })}>
              {picture.variants.map((variant) => (
                <option key={variant.name} value={variant.name}>
                  {variant.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Covers the screen">
          <select className={SELECT_CLASS_NAME} value={placement.spread} onChange={(event) => onChange({ spread: event.target.value as PlacementSpread })}>
            {Object.entries(SPREAD_NAMES).map(([spread, name]) => (
              <option key={spread} value={spread}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        {placement.spread !== 'screen' && (
          <Field label="Size of each pixel">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-lg" className="rounded-full" aria-label="Make smaller" disabled={placement.pixelSize <= 1} onClick={() => onChange({ pixelSize: placement.pixelSize - 1 })}>
                <Minus />
              </Button>
              <span className="w-16 text-center tabular-nums">{placement.pixelSize} px</span>
              <Button variant="outline" size="icon-lg" className="rounded-full" aria-label="Make bigger" disabled={placement.pixelSize >= 32} onClick={() => onChange({ pixelSize: placement.pixelSize + 1 })}>
                <Plus />
              </Button>
            </div>
          </Field>
        )}

        <Field label={`How solid it is: ${placement.opacity}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            className="soft-slider h-10 w-full"
            value={placement.opacity}
            onChange={(event) => onChange({ opacity: Number(event.target.value) }, `opacity-${placement.id}`)}
          />
        </Field>

        {isPlacedOnce && (
          <Field label="Across the screen (%)">
            <NumberInput value={placement.x} onChange={(x) => onChange({ x }, `x-${placement.id}`)} />
          </Field>
        )}

        {hasHeight && (
          <>
            <Field label={placement.anchor === 'top' ? 'Down from the top (%)' : 'Up from the bottom (screen pixels)'}>
              <NumberInput value={placement.y} onChange={(y) => onChange({ y }, `y-${placement.id}`)} />
            </Field>
            <Field label="Height counts from">
              <select className={SELECT_CLASS_NAME} value={placement.anchor} onChange={(event) => onChangeAnchor(event.target.value as 'top' | 'bottom')}>
                <option value="top">The top of the screen, for the sky</option>
                <option value="bottom">The bottom of the screen, for the ground</option>
              </select>
            </Field>
          </>
        )}

        {isPlacedOnce && (
          <Field label="Moves about">
            <select className={SELECT_CLASS_NAME} value={placement.motion} onChange={(event) => onChange({ motion: event.target.value as PlacementMotion })}>
              {Object.entries(MOTION_NAMES).map(([motion, name]) => (
                <option key={motion} value={motion}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {isPlacedOnce && <Checkbox label="Face the other way" isChecked={placement.isFlipped} onChange={(isFlipped) => onChange({ isFlipped })} />}
    </section>
  )
}

const SELECT_CLASS_NAME = 'h-10 w-full rounded-lg border border-input bg-card px-2 text-sm font-semibold'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  )
}

/** A number box that only reports numbers, so that it can be cleared and typed into without the value jumping about. */
function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Input
      type="number"
      step="0.5"
      className="h-10 bg-card"
      defaultValue={value}
      // Remounting when the value changes elsewhere, such as by dragging, keeps the box showing it.
      key={value}
      onBlur={(event) => {
        const typed = Number.parseFloat(event.target.value)
        if (Number.isFinite(typed) && typed !== value) onChange(typed)
      }}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
    />
  )
}

function Checkbox({ label, isChecked, onChange }: { label: string; isChecked: boolean; onChange: (isChecked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="size-5 accent-primary" checked={isChecked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}
