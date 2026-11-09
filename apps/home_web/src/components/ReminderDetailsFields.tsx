import { DueTimePicker } from '@/components/DueTimePicker'
import type { ReminderDraft } from '@/components/reminderDraft'
import { Textarea } from '@/components/ui/textarea'

interface ReminderDetailsFieldsProps {
  draft: ReminderDraft
  onChange: (draft: ReminderDraft) => void
}

/** The optional parts of a reminder: its notes and due time. Forms show the title themselves, in their own style. */
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
      <DueTimePicker value={draft.dueAt} onChange={(dueAt) => onChange({ ...draft, dueAt })} />
    </div>
  )
}
