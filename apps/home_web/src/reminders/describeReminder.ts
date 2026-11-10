import { differenceInCalendarDays, format, isSameDay } from 'date-fns'

import type { Reminder } from '@/reminders/reminder'

/**
 * How pressing a reminder is, which decides how it is highlighted.
 *
 * - `overdue`: due in the past and not completed.
 * - `dueToday`: due later today and not completed.
 * - `upcoming`: due after today and not completed.
 * - `unscheduled`: has no due time and is not completed.
 * - `completed`: ticked off, whenever it was due.
 */
export type Urgency = 'overdue' | 'dueToday' | 'upcoming' | 'unscheduled' | 'completed'

/** How far away a due time is, split so that the number can be shown prominently. */
export interface Countdown {
  /** The prominent part, such as "3" or "<1". */
  value: string
  /** The part beneath it, such as "hours" or "days ago". */
  caption: string
}

/** A due time, split so that a narrow screen can wrap it between the date and the time, rather than within either. */
export interface DueLabel {
  /** The date, such as "Mon 10 Nov". */
  date: string
  /** The time of day, such as "12:00". */
  time: string
}

/** Everything needed to show a reminder's timing, in the viewer's local time zone. */
export interface ReminderDescription {
  urgency: Urgency
  /** The due time, or null if there is no due time. */
  dueLabel: DueLabel | null
  /** How far away the due time is, or null if there is no due time. */
  countdown: Countdown | null
}

/**
 * Describes a reminder's timing relative to the current time.
 *
 * @param reminder The reminder to describe.
 * @param now The current time.
 * @returns The description, using the viewer's local time zone for labels and for deciding what "today" is.
 */
export function describeReminder(reminder: Reminder, now: Date): ReminderDescription {
  const { dueAt } = reminder
  return {
    urgency: describeUrgency(reminder, now),
    dueLabel: dueAt ? { date: format(dueAt, 'EEE d MMM'), time: format(dueAt, 'HH:mm') } : null,
    countdown: dueAt ? describeTimeUntil(dueAt, now) : null,
  }
}

function describeUrgency(reminder: Reminder, now: Date): Urgency {
  if (reminder.completedAt) return 'completed'
  if (!reminder.dueAt) return 'unscheduled'
  if (reminder.dueAt < now) return 'overdue'
  if (isSameDay(reminder.dueAt, now)) return 'dueToday'
  return 'upcoming'
}

function describeTimeUntil(dueAt: Date, now: Date): Countdown {
  const isInFuture = dueAt > now
  if (isSameDay(dueAt, now)) {
    const hours = Math.floor(Math.abs(dueAt.getTime() - now.getTime()) / 3_600_000)
    return createCountdown(hours, 'hour', isInFuture)
  }

  // Comparing dates rather than durations means that something due just after midnight is "1 day" away.
  return createCountdown(Math.abs(differenceInCalendarDays(dueAt, now)), 'day', isInFuture)
}

function createCountdown(count: number, singularUnit: string, isInFuture: boolean): Countdown {
  const unit = count <= 1 ? singularUnit : `${singularUnit}s`
  return { value: count === 0 ? '<1' : String(count), caption: isInFuture ? unit : `${unit} ago` }
}
