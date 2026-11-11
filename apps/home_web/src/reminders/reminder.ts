/** How often a repeating reminder comes round again. */
export type Repeat = 'daily' | 'every_2_days' | 'every_3_days' | 'every_4_days' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly'

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
  /**
   * How often the reminder comes round again, or null if it happens once. Only a reminder with a due time can repeat.
   * Ticking off a repeating reminder makes the API add the next one, and the ticked-off one stops repeating.
   */
  repeats: Repeat | null
}

/** The parts of a reminder that a person writes, as opposed to its identity and whether it is done. */
export type ReminderContent = Pick<Reminder, 'title' | 'notes' | 'dueAt' | 'repeats'>
