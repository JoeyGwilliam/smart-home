import { createTask } from '@/timers/timer'

test('gives the task a UUID when creating it', () => {
  const task = createTask('Shower', 15)

  expect(task).toEqual({
    id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    name: 'Shower',
    minutes: 15,
  })
})

test('gives tasks different ids when they have identical content', () => {
  const firstTask = createTask('Shower', 15)
  const secondTask = createTask('Shower', 15)

  expect(firstTask.id).not.toBe(secondTask.id)
})
