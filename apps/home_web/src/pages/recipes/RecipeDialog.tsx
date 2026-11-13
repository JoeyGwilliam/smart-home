import { ImagePlus, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createDraft, describeSaveFailure, isDraftComplete, toRecipeToSave, type RecipeDraft } from '@/pages/recipes/recipeDraft'
import type { Recipe } from '@/recipes/recipe'
import { getPictureUrl } from '@/recipes/recipesApi'
import { useRecipeActions } from '@/recipes/useRecipes'

interface RecipeDialogProps {
  /** The recipe to edit, or null to write a new one. */
  recipe: Recipe | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

/** A dialog for writing a new recipe or changing one: its name, ingredients, time, instructions and picture. Closes once it is saved. */
export function RecipeDialog({ recipe, isOpen, onOpenChange }: RecipeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-4xl border-[3px] border-panel-edge bg-popover/95 p-6 shadow-2xl shadow-shade sm:max-w-lg">
        {/* The form only exists while the dialog is open, so each opening starts from the recipe as it is now. */}
        <RecipeForm recipe={recipe} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

interface RecipeFormProps {
  recipe: Recipe | null
  onSaved: () => void
}

const FIELD_CLASS_NAME = 'rounded-2xl border-input bg-field px-4 text-base'

function RecipeForm({ recipe, onSaved }: RecipeFormProps) {
  const { saveRecipe } = useRecipeActions()
  const [draft, setDraft] = useState(() => createDraft(recipe ?? undefined))
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!isDraftComplete(draft) || isSaving) return

    setIsSaving(true)
    const outcome = await saveRecipe(toRecipeToSave(draft, recipe?.id ?? null))
    setIsSaving(false)
    if (outcome === 'saved') {
      onSaved()
    } else {
      setFailureMessage(describeSaveFailure(outcome))
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-2xl font-semibold">{recipe ? 'Edit recipe' : 'New recipe'}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            aria-label="Name"
            placeholder="Shepherd's pie"
            className={`h-12 text-lg! font-semibold ${FIELD_CLASS_NAME}`}
          />
        </Field>
        <Field label="Ingredients" hint="One on each line">
          <Textarea
            value={draft.ingredients}
            onChange={(event) => setDraft({ ...draft, ingredients: event.target.value })}
            aria-label="Ingredients"
            placeholder={'500g lamb mince\n1kg potatoes\n1 onion'}
            rows={4}
            className={`py-2.5 ${FIELD_CLASS_NAME}`}
          />
        </Field>
        <Field label="Time in minutes" hint="Optional">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={draft.timeMinutes}
            onChange={(event) => setDraft({ ...draft, timeMinutes: event.target.value })}
            aria-label="Time in minutes"
            placeholder="45"
            className={`h-11 w-32 ${FIELD_CLASS_NAME}`}
          />
        </Field>
        <Field label="Instructions" hint="Optional">
          <Textarea
            value={draft.instructions}
            onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
            aria-label="Instructions"
            placeholder="Brown the mince, then top with mash and bake."
            rows={4}
            className={`py-2.5 ${FIELD_CLASS_NAME}`}
          />
        </Field>
        <PicturePicker picture={draft.picture} onChange={(picture) => setDraft({ ...draft, picture })} />
      </div>
      {failureMessage && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {failureMessage}
        </p>
      )}
      <DialogFooter className="-mx-6 -mb-6 rounded-b-4xl border-border/60 bg-accent/50 px-6 py-4">
        <DialogClose asChild>
          <Button type="button" variant="ghost" className="h-10 rounded-full px-5 font-bold">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!isDraftComplete(draft) || isSaving} className="h-10 rounded-full px-6 font-bold shadow-md shadow-shade">
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// Each control names itself with an aria-label matching its field's label, so that the hint isn't read as part of its name.
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="px-1 text-sm font-bold">
        {label}
        {hint && <span className="ml-2 font-semibold text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

interface PicturePickerProps {
  picture: RecipeDraft['picture']
  onChange: (picture: RecipeDraft['picture']) => void
}

/** Shows the recipe's picture, if it has one, with buttons to choose a different one or remove it. */
function PicturePicker({ picture, onChange }: PicturePickerProps) {
  const pictureSource = usePictureSource(picture)

  return (
    <div className="grid gap-2">
      <span className="px-1 text-sm font-bold">
        Picture <span className="ml-1 font-semibold text-muted-foreground">Optional</span>
      </span>
      {pictureSource && <img src={pictureSource} alt="The recipe's picture" className="aspect-video w-full rounded-2xl object-cover" />}
      <div className="flex flex-wrap gap-2">
        {/* A file input can't be styled, so it is hidden inside a label that looks like a button. */}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-secondary px-4 font-bold text-secondary-foreground transition hover:brightness-95 focus-within:ring-3 focus-within:ring-ring/50">
          <ImagePlus className="size-4" />
          {picture ? 'Choose another picture' : 'Choose a picture'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onChange(file)
              // Clearing the input lets the same file be chosen again after it has been removed.
              event.target.value = ''
            }}
          />
        </label>
        {picture && (
          <Button type="button" variant="ghost" onClick={() => onChange(null)} className="h-10 rounded-full px-4 font-bold">
            <X />
            Remove picture
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Gives the address to show a picture from: the API's, for a picture the recipe already has, or the file's own
 * contents, for a file that was just chosen. A chosen file has no address until it has been read, which is quick.
 */
function usePictureSource(picture: RecipeDraft['picture']): string | null {
  const [fileSource, setFileSource] = useState<{ file: Blob; source: string } | null>(null)

  useEffect(() => {
    if (!(picture instanceof Blob)) return
    // The file is read as a data URL, rather than given a temporary blob address, because that address would have to
    // be let go when the picture changes, and React runs effects twice in development, letting go of it too soon.
    const reader = new FileReader()
    reader.onload = () => setFileSource({ file: picture, source: reader.result as string })
    reader.readAsDataURL(picture)
    return () => reader.abort()
  }, [picture])

  if (picture === null) return null
  if (typeof picture === 'string') return getPictureUrl(picture)
  return fileSource?.file === picture ? fileSource.source : null
}
