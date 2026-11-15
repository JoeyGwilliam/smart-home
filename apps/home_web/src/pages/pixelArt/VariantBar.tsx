import { CopyPlus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_VARIANTS } from '@/pixelArt/editPicture'
import type { ArtVariant } from '@/pixelArt/pixelArt'

interface VariantBarProps {
  variants: ArtVariant[]
  chosenVariantIndex: number
  onChoose: (variantIndex: number) => void
  /** Called to add a copy of the chosen variant straight after it. */
  onAdd: () => void
  onRename: (name: string) => void
  onRemove: () => void
}

/**
 * A picture's variants, the ways it can look, such as a cow's poses or an umbrella's colours. One is chosen to work on;
 * it can be renamed, copied to start another from, or taken away. Scenes ask for variants by name.
 */
export function VariantBar({ variants, chosenVariantIndex, onChoose, onAdd, onRename, onRemove }: VariantBarProps) {
  const chosenVariant = variants[chosenVariantIndex]

  return (
    <section aria-label="Variants" className="grid gap-3 rounded-2xl bg-field/70 p-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose a variant">
        {variants.map((variant, variantIndex) => (
          <Button
            key={variant.name}
            variant={variantIndex === chosenVariantIndex ? 'default' : 'outline'}
            aria-pressed={variantIndex === chosenVariantIndex}
            onClick={() => onChoose(variantIndex)}
            className="h-9 rounded-full px-4 font-bold"
          >
            {variant.name}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-semibold">
          Variant name
          <Input
            key={chosenVariant.name}
            defaultValue={chosenVariant.name}
            maxLength={40}
            onBlur={(event) => event.target.value.trim() !== chosenVariant.name && onRename(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            className="h-9 w-48 bg-card"
          />
        </label>
        <Button variant="outline" disabled={variants.length >= MAX_VARIANTS} onClick={onAdd} className="h-9 rounded-full px-3 font-bold">
          <CopyPlus />
          Copy into a new variant
        </Button>
        <Button variant="outline" disabled={variants.length <= 1} onClick={onRemove} className="h-9 rounded-full px-3 font-bold">
          <Trash2 />
          Remove this variant
        </Button>
      </div>
    </section>
  )
}
