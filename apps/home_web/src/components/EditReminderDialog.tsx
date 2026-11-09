import { useState, type FormEvent } from 'react'

import { ReminderDetailsFields } from '@/components/ReminderDetailsFields'
import { createDraft, describeSaveFailure, isDraftComplete, toReminderContent } from '@/components/reminderDraft'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Reminder } from '@/reminders/reminder'
import { useReminderActions } from '@/reminders/useReminders'

interface EditReminderDialogProps {
  reminder: Reminder
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

/** A dialog for changing what a reminder says and when it is due. Closes once the change is saved. */
export function EditReminderDialog({ reminder, isOpen, onOpenChange }: EditReminderDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-4xl border border-glass-edge bg-popover/95 p-6 shadow-2xl shadow-primary/25 backdrop-blur-xl sm:max-w-md">
        {/* The form only exists while the dialog is open, so each opening starts from the reminder as it is now. */}
        <EditReminderForm reminder={reminder} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

interface EditReminderFormProps {
  reminder: Reminder
  onSaved: () => void
}

function EditReminderForm({ reminder, onSaved }: EditReminderFormProps) {
  const { saveReminder } = useReminderActions()
  const [draft, setDraft] = useState(() => createDraft(reminder))
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!isDraftComplete(draft) || isSaving) return

    setIsSaving(true)
    const outcome = await saveReminder({ ...reminder, ...toReminderContent(draft) })
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
        <DialogTitle className="text-2xl font-semibold">Edit reminder</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <Input
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          aria-label="Title"
          className="h-12 rounded-2xl border-input bg-field px-4 text-lg font-semibold"
        />
        <ReminderDetailsFields draft={draft} onChange={setDraft} />
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
        <Button type="submit" disabled={!isDraftComplete(draft) || isSaving} className="h-10 rounded-full px-6 font-bold shadow-md shadow-primary/30">
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}
