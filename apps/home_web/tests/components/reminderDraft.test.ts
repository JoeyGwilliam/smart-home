import { createDraft, isDraftComplete, toReminderContent } from '@/components/reminderDraft'

test('is incomplete when the title is only whitespace', () => {
  const draft = { title: '   ', notes: '', dueAt: null }

  const isComplete = isDraftComplete(draft)

  expect(isComplete).toBe(false)
})

test('is complete when the title has text', () => {
  const draft = { title: 'Water the plants', notes: '', dueAt: null }

  const isComplete = isDraftComplete(draft)

  expect(isComplete).toBe(true)
})

test('trims the title and notes when converting to content', () => {
  const draft = { title: '  Water the plants ', notes: ' The fern too  ', dueAt: null }

  const content = toReminderContent(draft)

  expect(content).toEqual({ title: 'Water the plants', notes: 'The fern too', dueAt: null })
})

test('has no notes when the notes are blank', () => {
  const draft = { title: 'Water the plants', notes: '  ', dueAt: null }

  const content = toReminderContent(draft)

  expect(content.notes).toBeNull()
})

test('starts with empty notes when the reminder has none', () => {
  const content = { title: 'Water the plants', notes: null, dueAt: null }

  const draft = createDraft(content)

  expect(draft).toEqual({ title: 'Water the plants', notes: '', dueAt: null })
})
