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
