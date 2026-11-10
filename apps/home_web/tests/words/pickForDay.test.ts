import { pickForDay } from '@/words/pickForDay'

test('gives the same entry when the times are on the same day', () => {
  const entries = ['first', 'second', 'third']

  const morningEntry = pickForDay(entries, new Date(2026, 10, 10, 0, 5))
  const eveningEntry = pickForDay(entries, new Date(2026, 10, 10, 23, 55))

  expect(morningEntry).toBe(eveningEntry)
})

test('gives the next entry when the day is the day after', () => {
  const entries = ['first', 'second', 'third']

  const firstDaysEntry = pickForDay(entries, new Date(2000, 0, 1, 23, 55))
  const secondDaysEntry = pickForDay(entries, new Date(2000, 0, 2, 0, 5))

  expect(firstDaysEntry).toBe('first')
  expect(secondDaysEntry).toBe('second')
})

test('starts the list again when every entry has had its day', () => {
  const entries = ['first', 'second', 'third']

  const entry = pickForDay(entries, new Date(2000, 0, 4))

  expect(entry).toBe('first')
})

test('gives the last entry when the day is the one before the list starts', () => {
  const entries = ['first', 'second', 'third']

  const entry = pickForDay(entries, new Date(1999, 11, 31))

  expect(entry).toBe('third')
})
