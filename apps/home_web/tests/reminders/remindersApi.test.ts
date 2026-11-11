import {
  createReminder,
  deleteReminder,
  InvalidReminderError,
  listReminders,
  RemindersUnavailableError,
  saveReminder,
} from '@/reminders/remindersApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('converts reminders from the API format when listing them', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
    { id: 'abc', title: 'Water the plants', notes: 'The fern too', due_at: '2026-11-10T09:00:00Z', completed_at: null, repeats: 'weekly', assigned_to: 'Joey' },
  ])))

  const reminders = await listReminders()

  expect(reminders).toEqual([
    { id: 'abc', title: 'Water the plants', notes: 'The fern too', dueAt: new Date('2026-11-10T09:00:00Z'), completedAt: null, repeats: 'weekly', assignedTo: 'Joey' },
  ])
})

test('posts the content in the API format when creating a reminder', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(
    { id: 'abc', title: 'Water the plants', notes: null, due_at: '2026-11-10T09:00:00Z', completed_at: null, repeats: 'daily', assigned_to: 'Georgie' },
    { status: 201 },
  ))
  vi.stubGlobal('fetch', fetch)

  await createReminder({ title: 'Water the plants', notes: null, dueAt: new Date('2026-11-10T09:00:00Z'), repeats: 'daily', assignedTo: 'Georgie' })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/reminders')
  expect(request.method).toBe('POST')
  expect(JSON.parse(request.body)).toEqual({
    title: 'Water the plants',
    notes: null,
    due_at: '2026-11-10T09:00:00.000Z',
    completed_at: null,
    repeats: 'daily',
    assigned_to: 'Georgie',
  })
})

test('puts the whole reminder at its own address when saving it', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)

  await saveReminder({ id: 'abc', title: 'Water the plants', notes: null, dueAt: null, completedAt: new Date('2026-11-09T10:00:00Z'), repeats: null, assignedTo: null })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/reminders/abc')
  expect(request.method).toBe('PUT')
  expect(JSON.parse(request.body)).toEqual({ title: 'Water the plants', notes: null, due_at: null, completed_at: '2026-11-09T10:00:00.000Z', repeats: null, assigned_to: null })
})

test('sends a delete to the reminder\'s address when deleting it', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await deleteReminder('abc')

  expect(fetch).toHaveBeenCalledWith('/api/reminders/abc', expect.objectContaining({ method: 'DELETE' }))
})

test('throws InvalidReminderError when the API rejects the content', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 422 })))

  const creating = createReminder({ title: ' ', notes: null, dueAt: null, repeats: null, assignedTo: null })

  await expect(creating).rejects.toBeInstanceOf(InvalidReminderError)
})

test('throws RemindersUnavailableError when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  const listing = listReminders()

  await expect(listing).rejects.toBeInstanceOf(RemindersUnavailableError)
})

test('throws RemindersUnavailableError when the proxy reports the API is down', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))

  const listing = listReminders()

  await expect(listing).rejects.toBeInstanceOf(RemindersUnavailableError)
})
