/** A reminder held by the reminders API. */
export interface Reminder {
  /** Unique identifier that stays the same when the reminder is edited. */
  id: string
  /** Short description of the reminder. Always contains non-whitespace text. */
  title: string
  /** Optional longer details. */
  notes: string | null
  /** When the reminder is due, or null if it has no due time. */
  dueAt: Date | null
  /** When the reminder was ticked off, or null if it hasn't been. */
  completedAt: Date | null
}

/** The parts of a reminder that a person writes, as opposed to its identity and whether it is done. */
export type ReminderContent = Pick<Reminder, 'title' | 'notes' | 'dueAt'>
