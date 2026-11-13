import { Save, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SaveOutcome } from '@/homeApi/homeApi'
import type { TimerPlan, TimerPreset } from '@/timers/timer'
import { useTimerPresetActions, useTimerPresets } from '@/timers/useTimerPresets'

const FAILURE_MESSAGES: Record<Exclude<SaveOutcome, 'saved'>, string> = {
  invalid: "That timer couldn't be saved. Check that it and each of its tasks has a name.",
  unavailable: "Couldn't reach your presets. Your timer is still here, so try again in a moment.",
}

interface TimerPresetsProps {
  /** The plan being worked on, which is what gets saved. */
  plan: TimerPlan
  /** Called with the plan to work on instead: the same one renamed, or a preset that was chosen. */
  onChange: (plan: TimerPlan) => void
}

/** The saved presets, each of which can be loaded or deleted, and a form that saves the current plan under a name. */
export function TimerPresets({ plan, onChange }: TimerPresetsProps) {
  const presetsQuery = useTimerPresets()
  const { savePlanAsPreset, deletePreset } = useTimerPresetActions()
  const [presetToDelete, setPresetToDelete] = useState<TimerPreset | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // What the last change came to, shown until the next one.
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  const canSave = plan.name.trim() !== '' && plan.tasks.every((task) => task.name.trim() !== '') && !isSaving

  const savePlan = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setIsSaving(true)
    setOutcome(await savePlanAsPreset(plan))
    setIsSaving(false)
  }

  const loadPreset = (preset: TimerPreset) => {
    onChange(preset.plan)
    setOutcome(null)
  }

  const deleteChosenPreset = async (preset: TimerPreset) => {
    const deleteOutcome = await deletePreset(preset.id)
    // A deleted preset simply leaves the list, which needs no announcement.
    setOutcome(deleteOutcome === 'saved' ? null : deleteOutcome)
  }

  return (
    <section className="panel grid gap-4 rounded-4xl px-5 py-5 shadow-lg shadow-shade sm:px-7 sm:py-6" aria-labelledby="presets-heading">
      <h2 id="presets-heading" className="text-2xl font-semibold">
        Presets
      </h2>

      <PresetList presets={presetsQuery.data} hasFetchFailed={presetsQuery.isError} onLoad={loadPreset} onDelete={setPresetToDelete} />

      <form onSubmit={savePlan} className="flex flex-wrap items-center gap-2">
        <Input
          value={plan.name}
          onChange={(event) => onChange({ ...plan, name: event.target.value })}
          placeholder="Name this timer to save it"
          aria-label="Timer name"
          className="h-11 min-w-40 flex-1 rounded-full bg-field px-4 text-base! font-semibold"
        />
        <Button type="submit" disabled={!canSave} className="h-11 rounded-full px-5 text-base font-bold shadow-md shadow-shade">
          <Save />
          Save
        </Button>
      </form>

      {outcome === null ? (
        <p className="text-sm text-muted-foreground">Saving under a name that is already taken replaces that preset.</p>
      ) : outcome === 'saved' ? (
        <p role="status" className="text-sm font-semibold text-primary-text">
          Saved.
        </p>
      ) : (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {FAILURE_MESSAGES[outcome]}
        </p>
      )}

      <ConfirmDeleteDialog
        question="Delete this preset?"
        itemName={presetToDelete?.plan.name ?? ''}
        isOpen={presetToDelete !== null}
        onOpenChange={(isOpen) => !isOpen && setPresetToDelete(null)}
        onConfirm={() => presetToDelete && void deleteChosenPreset(presetToDelete)}
      />
    </section>
  )
}

interface PresetListProps {
  /** Every preset, or undefined while none have been fetched. */
  presets: TimerPreset[] | undefined
  /** Whether the latest attempt to fetch the presets failed. */
  hasFetchFailed: boolean
  onLoad: (preset: TimerPreset) => void
  /** Called when the person asks to delete a preset, before they have confirmed it. */
  onDelete: (preset: TimerPreset) => void
}

function PresetList({ presets, hasFetchFailed, onLoad, onDelete }: PresetListProps) {
  if (!presets) {
    // While the first fetch is on its way the line is kept empty, rather than flashing a message that is about to go.
    return <p className="min-h-6 text-muted-foreground">{hasFetchFailed && "Can't reach your presets right now."}</p>
  }
  if (presets.length === 0) return <p className="text-muted-foreground">No presets yet. Save this timer to use it again another day.</p>

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Saved presets">
      {presets.map((preset) => (
        <li key={preset.id} className="flex items-center rounded-full bg-secondary text-secondary-foreground">
          <button
            type="button"
            onClick={() => onLoad(preset)}
            aria-label={`Load ${preset.plan.name}`}
            className="rounded-l-full py-1.5 pr-1.5 pl-4 font-bold transition hover:text-primary-text"
          >
            {preset.plan.name} <span className="font-semibold opacity-70 tabular-nums">· {preset.plan.endTime}</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(preset)}
            aria-label={`Delete ${preset.plan.name}`}
            className="mr-1 grid size-7 place-items-center rounded-full opacity-60 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}
