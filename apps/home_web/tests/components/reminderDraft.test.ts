import { createDraft, isDraftComplete, toReminderContent } from '@/components/reminderDraft'

test('is incomplete when the title is only whitespace', () => {
  const draft = { title: '   ', notes: '', dueAt: null, isAllDay: false, repeats: null, assignedTo: null }

  const isComplete = isDraftComplete(draft)

  expect(isComplete).toBe(false)
})

test('is complete when the title has text', () => {
  const draft = { title: 'Water the plants', notes: '', dueAt: null, isAllDay: false, repeats: null, assignedTo: null }

  const isComplete = isDraftComplete(draft)

  expect(isComplete).toBe(true)
})

test('trims the title and notes when converting to content', () => {
  const draft = { title: '  Water the plants ', notes: ' The fern too  ', dueAt: null, isAllDay: false, repeats: null, assignedTo: null }

  const content = toReminderContent(draft)

  expect(content).toEqual({ title: 'Water the plants', notes: 'The fern too', dueAt: null, isAllDay: false, repeats: null, assignedTo: null })
})

test('has no notes when the notes are blank', () => {
  const draft = { title: 'Water the plants', notes: '  ', dueAt: null, isAllDay: false, repeats: null, assignedTo: null }

  const content = toReminderContent(draft)

  expect(content.notes).toBeNull()
})

test('starts with empty notes when the reminder has none', () => {
  const content = { title: 'Water the plants', notes: null, dueAt: null, isAllDay: false, repeats: null, assignedTo: null }

  const draft = createDraft(content)

  expect(draft).toEqual({ title: 'Water the plants', notes: '', dueAt: null, isAllDay: false, repeats: null, assignedTo: null })
})

test('drops the repeat when converting a draft with no due time', () => {
  const draft = { title: 'Water the plants', notes: '', dueAt: null, isAllDay: false, repeats: 'weekly' as const, assignedTo: null }

  const content = toReminderContent(draft)

  expect(content.repeats).toBeNull()
})

test('keeps the repeat when converting a draft with a due time', () => {
  const draft = { title: 'Water the plants', notes: '', dueAt: new Date('2026-11-10T09:00:00Z'), isAllDay: false, repeats: 'weekly' as const, assignedTo: null }

  const content = toReminderContent(draft)

  expect(content.repeats).toBe('weekly')
})

test('is not all day when converting an all-day draft with no due time', () => {
  const draft = { title: 'Bin day', notes: '', dueAt: null, isAllDay: true, repeats: null, assignedTo: null }

  const content = toReminderContent(draft)

  expect(content.isAllDay).toBe(false)
})

test('stays all day when converting an all-day draft with a due day', () => {
  const draft = { title: 'Bin day', notes: '', dueAt: new Date('2026-11-10T00:00:00Z'), isAllDay: true, repeats: null, assignedTo: null }

  const content = toReminderContent(draft)

  expect(content.isAllDay).toBe(true)
})
