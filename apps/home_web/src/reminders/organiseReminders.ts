import type { Reminder } from '@/reminders/reminder'

/** Reminders split into those still to do and those already done, each in the order they should be shown. */
export interface OrganisedReminders {
  /** Reminders that aren't completed, soonest due first. Those without a due time come last, oldest first. */
  active: Reminder[]
  /** Completed reminders, most recently completed first. */
  completed: Reminder[]
}

/**
 * Splits and orders reminders for display.
 *
 * @param reminders Every reminder, oldest first, as the API lists them. Not modified.
 * @returns The organised reminders.
 */
export function organiseReminders(reminders: readonly Reminder[]): OrganisedReminders {
  // toSorted is stable, so reminders that compare equal stay oldest first.
  const active = reminders
    .filter((reminder) => !reminder.completedAt)
    .toSorted((first, second) => compareDueTimes(first.dueAt, second.dueAt))
  const completed = reminders
    .filter((reminder) => reminder.completedAt)
    .toSorted((first, second) => second.completedAt!.getTime() - first.completedAt!.getTime())
  return { active, completed }
}

function compareDueTimes(first: Date | null, second: Date | null): number {
  if (first === null || second === null) return Number(first === null) - Number(second === null)
  return first.getTime() - second.getTime()
}
