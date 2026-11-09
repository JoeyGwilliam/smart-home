import { endOfDay, isSameDay } from 'date-fns'

import type { Reminder } from '@/reminders/reminder'

/**
 * Picks the reminders that matter today: everything due by the end of today that is still to do, including anything
 * overdue from earlier days, and those of them that were ticked off today, so that today's progress stays visible.
 *
 * @param reminders The reminders to choose from. Not modified.
 * @param now The current time, which decides what "today" is in the viewer's local time zone.
 * @returns The chosen reminders, in the order they were given.
 */
export function selectDueToday(reminders: readonly Reminder[], now: Date): Reminder[] {
  const endOfToday = endOfDay(now)
  return reminders.filter((reminder) => {
    if (!reminder.dueAt || reminder.dueAt > endOfToday) return false
    return !reminder.completedAt || isSameDay(reminder.completedAt, now)
  })
}
