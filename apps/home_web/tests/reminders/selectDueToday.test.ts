import type { Reminder } from '@/reminders/reminder'
import { selectDueToday } from '@/reminders/selectDueToday'

// Vitest runs in Europe/London (see vite.config.ts), and these dates are in winter, so local time is UTC.
function createReminder(overrides: Partial<Reminder>): Reminder {
  return { id: '1', title: 'Water the plants', notes: null, dueAt: null, isAllDay: false, completedAt: null, repeats: null, assignedTo: null, ...overrides }
}

test('includes a reminder when it is due later today', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-09T23:30:00Z') })

  const selected = selectDueToday([reminder], new Date('2026-11-09T10:00:00Z'))

  expect(selected).toEqual([reminder])
})

test('includes a reminder when it is overdue from an earlier day', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-02T09:00:00Z') })

  const selected = selectDueToday([reminder], new Date('2026-11-09T10:00:00Z'))

  expect(selected).toEqual([reminder])
})

test('excludes a reminder when it is due tomorrow', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-10T00:30:00Z') })

  const selected = selectDueToday([reminder], new Date('2026-11-09T10:00:00Z'))

  expect(selected).toEqual([])
})

test('excludes a reminder when it has no due time', () => {
  const reminder = createReminder({ dueAt: null })

  const selected = selectDueToday([reminder], new Date('2026-11-09T10:00:00Z'))

  expect(selected).toEqual([])
})

test('includes a reminder when it was ticked off today', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-09T09:00:00Z'), completedAt: new Date('2026-11-09T09:30:00Z') })

  const selected = selectDueToday([reminder], new Date('2026-11-09T10:00:00Z'))

  expect(selected).toEqual([reminder])
})

test('excludes a reminder when it was ticked off on an earlier day', () => {
  const reminder = createReminder({ dueAt: new Date('2026-11-08T09:00:00Z'), completedAt: new Date('2026-11-08T09:30:00Z') })

  const selected = selectDueToday([reminder], new Date('2026-11-09T10:00:00Z'))

  expect(selected).toEqual([])
})
