import { addDays, addMinutes, set, subMinutes } from 'date-fns'

import type { TimerPlan, TimerTask } from '@/timers/timer'

/** A task with the times it has to start and finish at for the plan to end on time. */
export interface ScheduledTask {
  task: TimerTask
  startsAt: Date
  /** When the task has to be finished, allowing for faffing. The next task starts at this moment. */
  endsAt: Date
}

/** When everything in a plan happens. */
export interface TimerSchedule {
  /** When the first task has to start. The same as `endsAt` when there are no tasks. */
  startsAt: Date
  /** The moment to be ready by. */
  endsAt: Date
  /** Every task in the plan, first to last. Each starts as the one before it ends, and the last ends at `endsAt`. */
  tasks: ScheduledTask[]
}

/**
 * Works out when each task of a plan has to start, by stacking the tasks back from the moment to be ready by. Each task
 * is given its minutes times the faff multiplier, rounded to a whole minute so that every start time is one a clock
 * shows.
 *
 * @param plan The plan to schedule. Its end time is ignored in favour of `endsAt`, which also says which day.
 * @param endsAt The moment to be ready by.
 * @returns The schedule.
 */
export function scheduleTimer(plan: TimerPlan, endsAt: Date): TimerSchedule {
  const tasks: ScheduledTask[] = []
  let nextTaskStartsAt = endsAt
  for (const task of plan.tasks.toReversed()) {
    const paddedMinutes = Math.max(1, Math.round(task.minutes * plan.faffMultiplier))
    const startsAt = subMinutes(nextTaskStartsAt, paddedMinutes)
    tasks.unshift({ task, startsAt, endsAt: addMinutes(startsAt, paddedMinutes) })
    nextTaskStartsAt = startsAt
  }
  return { startsAt: nextTaskStartsAt, endsAt, tasks }
}

/**
 * Finds the next moment that a clock shows a time of day.
 *
 * @param endTime The time of day, as "HH:mm".
 * @param after The moment to look forward from.
 * @returns The first moment after `after` with that time of day, in this device's time zone: later the same day if
 *   the time is still to come, and the next day otherwise.
 */
export function findNextEndTime(endTime: string, after: Date): Date {
  const [hours, minutes] = endTime.split(':').map(Number)
  const endsAtSameDay = set(after, { hours, minutes, seconds: 0, milliseconds: 0 })
  return endsAtSameDay > after ? endsAtSameDay : addDays(endsAtSameDay, 1)
}
