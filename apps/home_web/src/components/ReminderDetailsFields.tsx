import { DueTimePicker } from '@/components/DueTimePicker'
import { AssigneePicker } from '@/components/AssigneePicker'
import type { ReminderDraft } from '@/components/reminderDraft'
import { RepeatPicker } from '@/components/RepeatPicker'
import { Textarea } from '@/components/ui/textarea'

interface ReminderDetailsFieldsProps {
  draft: ReminderDraft
  onChange: (draft: ReminderDraft) => void
}

/**
 * The optional parts of a reminder: its notes, due time, how often it repeats and who it is for. Repeating is only offered once there
 * is a due time to repeat from. Forms show the title themselves, in their own style.
 */
export function ReminderDetailsFields({ draft, onChange }: ReminderDetailsFieldsProps) {
  return (
    <div className="grid gap-3">
      <Textarea
        value={draft.notes}
        onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        placeholder="Notes (optional)"
        aria-label="Notes"
        rows={2}
        className="min-h-0 resize-none rounded-2xl border-input bg-field px-4 py-2.5 text-base"
      />
      <div className="flex flex-wrap items-center gap-2">
        <DueTimePicker value={draft.dueAt} onChange={(dueAt) => onChange({ ...draft, dueAt })} />
        {draft.dueAt && <RepeatPicker value={draft.repeats} onChange={(repeats) => onChange({ ...draft, repeats })} />}
        <AssigneePicker value={draft.assignedTo} onChange={(assignedTo) => onChange({ ...draft, assignedTo })} />
      </div>
    </div>
  )
}
