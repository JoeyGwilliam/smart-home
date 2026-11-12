import { organiseReminders } from '@/reminders/organiseReminders'
import type { Reminder } from '@/reminders/reminder'

function createReminder(overrides: Partial<Reminder>): Reminder {
  return { id: '1', title: 'Water the plants', notes: null, dueAt: null, isAllDay: false, completedAt: null, repeats: null, assignedTo: null, ...overrides }
}

test('separates completed reminders from active ones when both exist', () => {
  const active = createReminder({ id: 'active' })
  const completed = createReminder({ id: 'completed', completedAt: new Date('2026-11-09T10:00:00Z') })

  const organised = organiseReminders([completed, active])

  expect(organised.active).toEqual([active])
  expect(organised.completed).toEqual([completed])
})

test('orders active reminders soonest due first when they have due times', () => {
  const later = createReminder({ id: 'later', dueAt: new Date('2026-11-12T10:00:00Z') })
  const sooner = createReminder({ id: 'sooner', dueAt: new Date('2026-11-10T10:00:00Z') })

  const organised = organiseReminders([later, sooner])

  expect(organised.active.map((reminder) => reminder.id)).toEqual(['sooner', 'later'])
})

test('puts active reminders without a due time last, oldest first, when mixed with due ones', () => {
  const oldestUnscheduled = createReminder({ id: 'oldest unscheduled' })
  const due = createReminder({ id: 'due', dueAt: new Date('2026-11-10T10:00:00Z') })
  const newestUnscheduled = createReminder({ id: 'newest unscheduled' })

  const organised = organiseReminders([oldestUnscheduled, due, newestUnscheduled])

  expect(organised.active.map((reminder) => reminder.id)).toEqual(['due', 'oldest unscheduled', 'newest unscheduled'])
})

test('orders completed reminders most recently completed first when several are done', () => {
  const completedEarlier = createReminder({ id: 'earlier', completedAt: new Date('2026-11-08T10:00:00Z') })
  const completedLater = createReminder({ id: 'later', completedAt: new Date('2026-11-09T10:00:00Z') })

  const organised = organiseReminders([completedEarlier, completedLater])

  expect(organised.completed.map((reminder) => reminder.id)).toEqual(['later', 'earlier'])
})
