// Reading the shared examples below needs Node's own modules, which the app itself never uses.
/// <reference types="node" />
import { format } from 'date-fns'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { findNextEndTime, scheduleTimer } from '@/timers/scheduleTimer'

test('stacks the tasks back from the end when there are several', () => {
  const plan = {
    name: 'Night out',
    endTime: '17:00',
    faffMultiplier: 1,
    tasks: [
      { id: 'shower', name: 'Shower', minutes: 15 },
      { id: 'makeup', name: 'Doing makeup', minutes: 20 },
    ],
  }

  const schedule = scheduleTimer(plan, new Date(2026, 10, 11, 17, 0))

  expect(schedule.startsAt).toEqual(new Date(2026, 10, 11, 16, 25))
  expect(schedule.tasks).toEqual([
    { task: plan.tasks[0], startsAt: new Date(2026, 10, 11, 16, 25), endsAt: new Date(2026, 10, 11, 16, 40) },
    { task: plan.tasks[1], startsAt: new Date(2026, 10, 11, 16, 40), endsAt: new Date(2026, 10, 11, 17, 0) },
  ])
})

test('gives every task longer when the faff multiplier is above one', () => {
  const plan = {
    name: 'Night out',
    endTime: '17:00',
    faffMultiplier: 1.5,
    tasks: [
      { id: 'shower', name: 'Shower', minutes: 10 },
      { id: 'makeup', name: 'Doing makeup', minutes: 20 },
    ],
  }

  const schedule = scheduleTimer(plan, new Date(2026, 10, 11, 17, 0))

  expect(schedule.tasks.map((scheduledTask) => scheduledTask.startsAt)).toEqual([
    new Date(2026, 10, 11, 16, 15),
    new Date(2026, 10, 11, 16, 30),
  ])
})

test('rounds a task to a whole minute when the faff multiplier gives it a fraction of one', () => {
  const plan = { name: 'Night out', endTime: '17:00', faffMultiplier: 1.1, tasks: [{ id: 'shoes', name: 'Shoes on', minutes: 7 }] }

  const schedule = scheduleTimer(plan, new Date(2026, 10, 11, 17, 0))

  expect(schedule.startsAt).toEqual(new Date(2026, 10, 11, 16, 52))
})

test('starts as it ends when there are no tasks', () => {
  const plan = { name: 'Night out', endTime: '17:00', faffMultiplier: 1, tasks: [] }

  const schedule = scheduleTimer(plan, new Date(2026, 10, 11, 17, 0))

  expect(schedule).toEqual({ startsAt: new Date(2026, 10, 11, 17, 0), endsAt: new Date(2026, 10, 11, 17, 0), tasks: [] })
})

test('finds the end time later the same day when it is still to come', () => {
  const twoInTheAfternoon = new Date(2026, 10, 11, 14, 0)

  const endsAt = findNextEndTime('17:00', twoInTheAfternoon)

  expect(endsAt).toEqual(new Date(2026, 10, 11, 17, 0))
})

test('finds the end time on the next day when it has already passed', () => {
  const sixInTheEvening = new Date(2026, 10, 11, 18, 0)

  const endsAt = findNextEndTime('17:00', sixInTheEvening)

  expect(endsAt).toEqual(new Date(2026, 10, 12, 17, 0))
})

test('finds the end time on the next day when it is that time exactly', () => {
  const fiveInTheEvening = new Date(2026, 10, 11, 17, 0)

  const endsAt = findNextEndTime('17:00', fiveInTheEvening)

  expect(endsAt).toEqual(new Date(2026, 10, 12, 17, 0))
})

// The Alexa skill works out the same schedule in Python (apps/api/alexa_api/src/alexa_api/core/timer_schedule.py), and
// Alexa and the screens must agree. Both are tested against these examples, which hold every moment as the time on
// the clock, without a time zone.
interface SharedExamples {
  schedules: {
    description: string
    faff_multiplier: number
    ends_at: string
    tasks: { name: string; duration_minutes: number; starts_at: string; ends_at: string }[]
    starts_at: string
  }[]
  next_end_times: { description: string; end_time: string; after: string; ends_at: string }[]
}

const SHARED_EXAMPLES_PATH = resolve(import.meta.dirname, '../../../api/timers_api/timer-schedule-examples.json')
const SHARED_EXAMPLES: SharedExamples = JSON.parse(readFileSync(SHARED_EXAMPLES_PATH, 'utf-8'))

function formatClockTime(moment: Date): string {
  return format(moment, "yyyy-MM-dd'T'HH:mm:ss")
}

test.each(SHARED_EXAMPLES.schedules)('gives the times of the shared example that $description', (example) => {
  const plan = {
    name: 'Shared example',
    endTime: '00:00',
    faffMultiplier: example.faff_multiplier,
    tasks: example.tasks.map((task, position) => ({ id: String(position), name: task.name, minutes: task.duration_minutes })),
  }

  const schedule = scheduleTimer(plan, new Date(example.ends_at))

  expect(formatClockTime(schedule.startsAt)).toBe(example.starts_at)
  expect(schedule.tasks.map((scheduledTask) => [formatClockTime(scheduledTask.startsAt), formatClockTime(scheduledTask.endsAt)])).toEqual(
    example.tasks.map((task) => [task.starts_at, task.ends_at]),
  )
})

test.each(SHARED_EXAMPLES.next_end_times)('gives the end time of the shared example that $description', (example) => {
  const endsAt = findNextEndTime(example.end_time, new Date(example.after))

  expect(formatClockTime(endsAt)).toBe(example.ends_at)
})
