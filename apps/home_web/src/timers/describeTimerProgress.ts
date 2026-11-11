import { format } from 'date-fns'

import type { ScheduledTask, TimerSchedule } from '@/timers/scheduleTimer'

/**
 * How far through a schedule the current time is.
 *
 * - `waiting`: the first task hasn't started yet.
 * - `underway`: the first task has started, and the moment to be ready by hasn't come.
 * - `finished`: the moment to be ready by has come.
 */
export type TimerStage = 'waiting' | 'underway' | 'finished'

/** Where the current time falls in a schedule. */
export interface TimerProgress {
  stage: TimerStage
  /** How much of the time between the schedule's start and its end has passed, from 0 to 1. */
  elapsedFraction: number
  /** The task that should be happening now, or null when waiting or finished. */
  currentTask: ScheduledTask | null
  /** The next task that has to start, or null once the last task has started. */
  nextTask: ScheduledTask | null
}

/**
 * Describes where the current time falls in a schedule.
 *
 * @param schedule The schedule.
 * @param now The current time.
 * @returns The progress.
 */
export function describeTimerProgress(schedule: TimerSchedule, now: Date): TimerProgress {
  const stage = now < schedule.startsAt ? 'waiting' : now < schedule.endsAt ? 'underway' : 'finished'
  const totalMilliseconds = schedule.endsAt.getTime() - schedule.startsAt.getTime()
  const elapsedMilliseconds = now.getTime() - schedule.startsAt.getTime()

  return {
    stage,
    // A schedule without tasks takes no time, so it is either wholly ahead or wholly behind.
    elapsedFraction: stage === 'underway' ? elapsedMilliseconds / totalMilliseconds : Number(stage === 'finished'),
    currentTask: schedule.tasks.find((scheduledTask) => scheduledTask.startsAt <= now && now < scheduledTask.endsAt) ?? null,
    nextTask: schedule.tasks.find((scheduledTask) => scheduledTask.startsAt > now) ?? null,
  }
}

/**
 * Writes what to say aloud when a timer reaches a new point in its schedule: the time, what to start, and how long
 * there is to do it.
 *
 * @param schedule The timer's schedule.
 * @param now The current time.
 * @returns A few short sentences, worded to be heard rather than read.
 */
export function describeAnnouncement(schedule: TimerSchedule, now: Date): string {
  const { stage, currentTask, nextTask } = describeTimerProgress(schedule, now)

  if (stage === 'finished') return `It's ${formatSpokenTime(now)}. Time's up.`
  if (currentTask) {
    const minutesLeft = Math.round((currentTask.endsAt.getTime() - now.getTime()) / 60_000)
    return `It's ${formatSpokenTime(now)}. Time to start ${nameTask(currentTask)}. You have ${describeMinutes(minutesLeft)}.`
  }
  if (nextTask) return `Timer set. ${nameTask(nextTask)} starts at ${formatSpokenTime(nextTask.startsAt)}.`
  return `Timer set for ${formatSpokenTime(schedule.endsAt)}.`
}

/**
 * Formats a length of time as a ticking countdown.
 *
 * @param milliseconds The time left. Anything below zero counts as zero.
 * @returns The time as minutes and seconds, such as "4:05", with hours in front once there are any, such as "1:04:05".
 */
export function formatCountdown(milliseconds: number): string {
  // Rounding up means the countdown reaches zero as the moment arrives, rather than a second before it.
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

function nameTask(scheduledTask: ScheduledTask): string {
  return scheduledTask.task.name.trim() || 'the next task'
}

// Speech reads "5 PM" more naturally than "5:00 PM".
function formatSpokenTime(moment: Date): string {
  return format(moment, moment.getMinutes() === 0 ? 'h a' : 'h:mm a')
}

function describeMinutes(totalMinutes: number): string {
  if (totalMinutes < 1) return 'less than a minute'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts = [
    ...(hours > 0 ? [`${hours} ${hours === 1 ? 'hour' : 'hours'}`] : []),
    ...(minutes > 0 ? [`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`] : []),
  ]
  return parts.join(' and ')
}
