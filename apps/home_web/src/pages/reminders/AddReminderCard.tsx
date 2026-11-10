import { Plus, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'

import { ReminderDetailsFields } from '@/components/ReminderDetailsFields'
import { createDraft, describeSaveFailure, isDraftComplete, toReminderContent } from '@/components/reminderDraft'
import { Button } from '@/components/ui/button'
import { useReminderActions } from '@/reminders/useReminders'

/**
 * A form for adding a reminder. It starts as a single title field and reveals the optional details once a title is
 * being typed, so that adding a quick reminder stays quick.
 */
export function AddReminderCard() {
  const { createReminder } = useReminderActions()
  const [draft, setDraft] = useState(createDraft)
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isExpanded = draft.title !== ''

  const addReminder = async (event: FormEvent) => {
    event.preventDefault()
    if (!isDraftComplete(draft) || isSaving) return

    setIsSaving(true)
    const outcome = await createReminder(toReminderContent(draft))
    setIsSaving(false)
    if (outcome === 'saved') {
      setDraft(createDraft())
      setFailureMessage(null)
    } else {
      setFailureMessage(describeSaveFailure(outcome))
    }
  }

  return (
    <motion.form
      layout
      onSubmit={addReminder}
      className="panel rounded-4xl p-2.5 shadow-lg shadow-shade transition-shadow focus-within:shadow-xl focus-within:shadow-shade"
    >
      <div className="flex items-center gap-3">
        <motion.span
          animate={{ rotate: isExpanded ? 45 : 0 }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          aria-hidden
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </motion.span>
        <input
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="Add a reminder…"
          aria-label="Title"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 10 }}
            >
              <Button
                type="submit"
                disabled={!isDraftComplete(draft) || isSaving}
                className="h-11 rounded-full px-5 text-base font-bold shadow-md shadow-shade"
              >
                <Sparkles />
                Add
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
            className="overflow-hidden"
          >
            <div className="px-1.5 pt-3 pb-1">
              <ReminderDetailsFields draft={draft} onChange={setDraft} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {failureMessage && (
        <p role="alert" className="px-3 pt-2 pb-1 text-sm font-semibold text-destructive">
          {failureMessage}
        </p>
      )}
    </motion.form>
  )
}
