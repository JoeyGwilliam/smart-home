import { describeReminder } from '@/reminders/describeReminder'
import type { Reminder } from '@/reminders/reminder'

// Vitest runs in Europe/London (see vite.config.ts), and these dates are in winter, so local time is UTC.
function createReminder(overrides: Partial<Reminder>): Reminder {
  return { id: '1', title: 'Water the plants', notes: null, dueAt: null, completedAt: null, ...overrides }
}

test('describes no due time when the reminder has none', () => {
  const reminder = createReminder({ dueAt: null })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description).toEqual({ urgency: 'unscheduled', dueLabel: null, countdown: null })
})

test('labels the due time in local time when the reminder has one', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-12T18:30:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.dueLabel).toEqual({ date: 'Thu 12 Nov', time: '18:30' })
})

test('is overdue when the due time has passed', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-09T09:00:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.urgency).toBe('overdue')
})

test('is due today when the due time is later today', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-09T22:00:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.urgency).toBe('dueToday')
})

test('is upcoming when the due time is after today', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-10T00:30:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T23:00:00Z'))

  expect(description.urgency).toBe('upcoming')
})

test('is completed when ticked off, even if the due time has passed', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-01T09:00:00Z'), completedAt: new Date('2026-11-02T09:00:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.urgency).toBe('completed')
})

test('counts down "<1 hour" when due in under an hour', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-09T10:45:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.countdown).toEqual({ value: '<1', caption: 'hour' })
})

test('counts whole hours when due later today', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-09T13:59:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.countdown).toEqual({ value: '3', caption: 'hours' })
})

test('counts hours ago when overdue earlier today', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-09T08:00:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.countdown).toEqual({ value: '2', caption: 'hours ago' })
})

test('counts one day when due just after midnight', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-10T00:30:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T23:00:00Z'))

  expect(description.countdown).toEqual({ value: '1', caption: 'day' })
})

test('counts days ago when overdue from an earlier day', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-06T18:00:00Z') })

  const description = describeReminder(reminder, new Date('2026-11-09T10:00:00Z'))

  expect(description.countdown).toEqual({ value: '3', caption: 'days ago' })
})
