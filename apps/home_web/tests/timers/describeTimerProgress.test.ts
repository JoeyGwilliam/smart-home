import { describeAnnouncement, describeTimerProgress, formatCountdown } from '@/timers/describeTimerProgress'
import type { TimerSchedule } from '@/timers/scheduleTimer'

/** A shower from 16:00 to 16:40, then makeup until 17:00. */
function createSchedule(): TimerSchedule {
  return {
    startsAt: new Date(2026, 10, 11, 16, 0),
    endsAt: new Date(2026, 10, 11, 17, 0),
    tasks: [
      { task: { id: 'shower', name: 'Shower', minutes: 40 }, startsAt: new Date(2026, 10, 11, 16, 0), endsAt: new Date(2026, 10, 11, 16, 40) },
      { task: { id: 'makeup', name: 'Doing makeup', minutes: 20 }, startsAt: new Date(2026, 10, 11, 16, 40), endsAt: new Date(2026, 10, 11, 17, 0) },
    ],
  }
}

test('is waiting for the first task when the schedule has not started', () => {
  const schedule = createSchedule()

  const progress = describeTimerProgress(schedule, new Date(2026, 10, 11, 15, 30))

  expect(progress).toEqual({ stage: 'waiting', elapsedFraction: 0, currentTask: null, nextTask: schedule.tasks[0] })
})

test('is on the first task with the second to come when a quarter of the time has passed', () => {
  const schedule = createSchedule()

  const progress = describeTimerProgress(schedule, new Date(2026, 10, 11, 16, 15))

  expect(progress).toEqual({ stage: 'underway', elapsedFraction: 0.25, currentTask: schedule.tasks[0], nextTask: schedule.tasks[1] })
})

test('moves on to a task when its start time arrives exactly', () => {
  const schedule = createSchedule()

  const progress = describeTimerProgress(schedule, new Date(2026, 10, 11, 16, 40))

  expect(progress.currentTask).toBe(schedule.tasks[1])
  expect(progress.nextTask).toBeNull()
})

test('is finished with no tasks left when the end has arrived', () => {
  const schedule = createSchedule()

  const progress = describeTimerProgress(schedule, new Date(2026, 10, 11, 17, 0))

  expect(progress).toEqual({ stage: 'finished', elapsedFraction: 1, currentTask: null, nextTask: null })
})

test('is waiting with nothing elapsed when a schedule without tasks has not ended', () => {
  const endsAt = new Date(2026, 10, 11, 17, 0)
  const emptySchedule = { startsAt: endsAt, endsAt, tasks: [] }

  const progress = describeTimerProgress(emptySchedule, new Date(2026, 10, 11, 16, 0))

  expect(progress).toEqual({ stage: 'waiting', elapsedFraction: 0, currentTask: null, nextTask: null })
})

test('announces the time, the task and how long it has when a task starts', () => {
  const announcement = describeAnnouncement(createSchedule(), new Date(2026, 10, 11, 16, 40))

  expect(announcement).toBe("It's 4:40 PM. Time to start Doing makeup. You have 20 minutes.")
})

test('announces only the time that is left when a task is joined part of the way through', () => {
  const announcement = describeAnnouncement(createSchedule(), new Date(2026, 10, 11, 16, 55))

  expect(announcement).toBe("It's 4:55 PM. Time to start Doing makeup. You have 5 minutes.")
})

test('announces hours and minutes when a task has more than an hour', () => {
  const longSchedule = {
    startsAt: new Date(2026, 10, 11, 15, 0),
    endsAt: new Date(2026, 10, 11, 16, 1),
    tasks: [{ task: { id: 'roast', name: 'Cooking the roast', minutes: 61 }, startsAt: new Date(2026, 10, 11, 15, 0), endsAt: new Date(2026, 10, 11, 16, 1) }],
  }

  const announcement = describeAnnouncement(longSchedule, new Date(2026, 10, 11, 15, 0))

  expect(announcement).toBe("It's 3 PM. Time to start Cooking the roast. You have 1 hour and 1 minute.")
})

test('announces when the first task starts when the timer is started early', () => {
  const announcement = describeAnnouncement(createSchedule(), new Date(2026, 10, 11, 15, 30))

  expect(announcement).toBe('Timer set. Shower starts at 4 PM.')
})

test('announces that time is up when the end has arrived', () => {
  const announcement = describeAnnouncement(createSchedule(), new Date(2026, 10, 11, 17, 0))

  expect(announcement).toBe("It's 5 PM. Time's up.")
})

test('formats a countdown as minutes and seconds when it is under an hour', () => {
  expect(formatCountdown(245_000)).toBe('4:05')
})

test('formats a countdown with hours when it is over an hour', () => {
  expect(formatCountdown(3_845_000)).toBe('1:04:05')
})

test('rounds a countdown up to the next second when it is part of the way through one', () => {
  expect(formatCountdown(59_001)).toBe('1:00')
})

test('formats a countdown as zero when the moment has passed', () => {
  expect(formatCountdown(-5000)).toBe('0:00')
})
