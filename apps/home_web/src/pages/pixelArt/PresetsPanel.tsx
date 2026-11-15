import { format } from 'date-fns'
import { Archive, Download, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaveOutcomeMessage, type LatestSave } from '@/pages/pixelArt/SaveOutcomeMessage'
import type { Preset } from '@/scenes/scenesApi'
import { usePresetActions, usePresets } from '@/scenes/usePresets'

/** What the person is about to do to a preset, which asks them to make sure first. */
type PendingChange = { kind: 'apply' | 'overwrite' | 'delete'; preset: Preset } | null

/**
 * The presets: saved copies of the whole design, every picture, layer and scene, to keep changes permanently and come
 * back to them. The site's own design is one of them, like any other. A preset can be put back on every screen, saved
 * over with the design as it is now, renamed, or deleted.
 */
export function PresetsPanel() {
  const presetsQuery = usePresets()
  const { savePreset, applyPreset, overwritePreset, renamePreset, deletePreset } = usePresetActions()
  const [name, setName] = useState('')
  const [latestSave, setLatestSave] = useState<LatestSave | null>(null)
  const [pendingChange, setPendingChange] = useState<PendingChange>(null)

  const saveCurrentDesign = async () => {
    const outcome = await savePreset(name)
    if (outcome === 'saved') setName('')
    setLatestSave({ outcome, successMessage: `Saved "${name.trim()}". Put it back whenever you like.` })
  }

  const confirmPendingChange = async () => {
    if (!pendingChange) return
    const { kind, preset } = pendingChange
    const change = { apply: applyPreset, overwrite: overwritePreset, delete: deletePreset }[kind]
    const successMessage = {
      apply: `Done. Every screen now shows "${preset.name}".`,
      overwrite: `Done. "${preset.name}" now holds the design as it is now.`,
      delete: `Deleted "${preset.name}".`,
    }[kind]
    setLatestSave({ outcome: await change(preset.id), successMessage })
  }

  const rename = async (preset: Preset, newName: string) => {
    if (!newName.trim() || newName.trim() === preset.name) return
    setLatestSave({ outcome: await renamePreset(preset.id, newName), successMessage: `Renamed "${preset.name}" to "${newName.trim()}".` })
  }

  return (
    <section aria-label="Presets" className="panel mx-auto grid w-full max-w-3xl gap-6 rounded-3xl p-4 shadow-md shadow-shade sm:p-6">
      <div className="grid gap-2">
        <h2 className="text-2xl font-semibold">Presets</h2>
        <p className="text-sm text-muted-foreground">
          A preset keeps a copy of every picture, layer and scene. Later changes never touch it until you save over it, so you can always
          come back to it. The site's own design is a preset too, which you can put back, change or rename.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void saveCurrentDesign()
        }}
      >
        <label className="grid min-w-60 flex-1 gap-1 text-sm font-semibold">
          Name for the design as it is now
          <Input value={name} maxLength={80} placeholder="Such as Winter" onChange={(event) => setName(event.target.value)} className="h-10 bg-field text-base" />
        </label>
        <Button type="submit" disabled={!name.trim()} className="h-10 rounded-full px-5 font-bold shadow-md shadow-shade">
          <Archive />
          Save as a new preset
        </Button>
      </form>

      <SaveOutcomeMessage latestSave={latestSave} />

      <ul className="grid gap-2" aria-label="Saved presets">
        {presetsQuery.data?.length === 0 && <li className="text-sm text-muted-foreground">No presets yet.</li>}
        {presetsQuery.data?.map((preset) => (
          <li key={preset.id} className="grid gap-2 rounded-2xl bg-field/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                aria-label={`Name of ${preset.name}`}
                key={preset.name}
                defaultValue={preset.name}
                maxLength={80}
                onBlur={(event) => void rename(preset, event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                className="h-9 min-w-48 flex-1 bg-card font-semibold"
              />
              <span className="text-xs text-muted-foreground">Saved {format(preset.savedAt, 'd MMMM yyyy, HH:mm')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" aria-label={`Put ${preset.name} back`} onClick={() => setPendingChange({ kind: 'apply', preset })} className="h-9 rounded-full px-4 font-bold">
                <RotateCcw />
                Put this back
              </Button>
              <Button
                variant="outline"
                aria-label={`Save the current design into ${preset.name}`}
                onClick={() => setPendingChange({ kind: 'overwrite', preset })}
                className="h-9 rounded-full px-4 font-bold"
              >
                <Download />
                Save the current design into this
              </Button>
              <Button variant="ghost" aria-label={`Delete ${preset.name}`} onClick={() => setPendingChange({ kind: 'delete', preset })} className="h-9 rounded-full px-3">
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDeleteDialog
        question="Delete this preset?"
        itemName={pendingChange?.kind === 'delete' ? pendingChange.preset.name : ''}
        isOpen={pendingChange?.kind === 'delete'}
        onOpenChange={(isOpen) => !isOpen && setPendingChange(null)}
        onConfirm={() => void confirmPendingChange()}
      />
      <AlertDialog open={pendingChange?.kind === 'apply' || pendingChange?.kind === 'overwrite'} onOpenChange={(isOpen) => !isOpen && setPendingChange(null)}>
        <AlertDialogContent className="rounded-4xl border-[3px] border-panel-edge bg-popover/95 p-6 shadow-2xl shadow-shade">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold">
              {pendingChange?.kind === 'overwrite' ? `Save the current design into "${pendingChange.preset.name}"?` : `Put "${pendingChange?.preset.name}" back?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {pendingChange?.kind === 'overwrite'
                ? 'What this preset held will be replaced by every picture, layer and scene as they are now.'
                : 'Every screen will change straight away. Any pictures, layers and scenes you have changed since will be replaced, so save them as a preset first if you want to keep them.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-full px-5 font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmPendingChange()} className="h-10 rounded-full px-5 font-bold">
              {pendingChange?.kind === 'overwrite' ? 'Save into it' : 'Put it back'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
