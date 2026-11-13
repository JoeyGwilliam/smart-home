import { ApiUnavailableError, reportOutcome, RequestRefusedError, sendToHomeApi } from '@/homeApi/homeApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('sends the body as JSON when a body is given', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)

  await sendToHomeApi('reminders', 'POST', '/api/reminders', { title: 'Water the plants' })

  expect(fetch).toHaveBeenCalledWith('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"title":"Water the plants"}',
  })
})

test('sends a file as it is, with its own type, when the body is a file', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 201 }))
  vi.stubGlobal('fetch', fetch)
  const picture = new Blob(['photo'], { type: 'image/jpeg' })

  await sendToHomeApi('recipes', 'POST', '/api/recipes/pictures', picture)

  expect(fetch).toHaveBeenCalledWith('/api/recipes/pictures', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: picture })
})

test('sends no body when none is given', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json([]))
  vi.stubGlobal('fetch', fetch)

  await sendToHomeApi('reminders', 'GET', '/api/reminders')

  expect(fetch).toHaveBeenCalledWith('/api/reminders', { method: 'GET' })
})

test('returns the response when the API answers with a success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ id: 'abc' }, { status: 201 })))

  const response = await sendToHomeApi('reminders', 'GET', '/api/reminders')

  expect(await response.json()).toEqual({ id: 'abc' })
})

test('throws ApiUnavailableError when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  const sending = sendToHomeApi('reminders', 'GET', '/api/reminders')

  await expect(sending).rejects.toBeInstanceOf(ApiUnavailableError)
})

test('throws ApiUnavailableError when the proxy reports the API is down', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })))

  const sending = sendToHomeApi('reminders', 'GET', '/api/reminders')

  await expect(sending).rejects.toBeInstanceOf(ApiUnavailableError)
})

test('throws RequestRefusedError with the reason when the API refuses in words', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'The site editor is busy.' }, { status: 409 })))

  const sending = sendToHomeApi('site editor', 'POST', '/api/site-editor/change/confirm')

  await expect(sending).rejects.toBeInstanceOf(RequestRefusedError)
  await expect(sending).rejects.toThrow('The site editor is busy.')
})

test('throws RequestRefusedError naming the request when the API lists faults in the content', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: [{ msg: 'Value error' }] }, { status: 422 })))

  const sending = sendToHomeApi('reminders', 'POST', '/api/reminders', { title: ' ' })

  await expect(sending).rejects.toBeInstanceOf(RequestRefusedError)
  await expect(sending).rejects.toThrow('The reminders API refused POST /api/reminders.')
})

test('throws RequestRefusedError when the proxy refuses a body that is too big', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Request Entity Too Large', { status: 413 })))

  const sending = sendToHomeApi('recipes', 'POST', '/api/recipes/pictures', new Blob(['photo'], { type: 'image/jpeg' }))

  await expect(sending).rejects.toBeInstanceOf(RequestRefusedError)
})

test('throws a plain error when the API answers with a status that no caller expects', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })))

  const sending = sendToHomeApi('reminders', 'GET', '/api/reminderz')

  await expect(sending).rejects.not.toBeInstanceOf(ApiUnavailableError)
  await expect(sending).rejects.toThrow('status 404')
})

test('reports saved when the change succeeds', async () => {
  const outcome = await reportOutcome(Promise.resolve())

  expect(outcome).toBe('saved')
})

test('reports invalid when the change is refused', async () => {
  const outcome = await reportOutcome(Promise.reject(new RequestRefusedError('The title is blank.')))

  expect(outcome).toBe('invalid')
})

test('reports unavailable when the API cannot be reached', async () => {
  const outcome = await reportOutcome(Promise.reject(new ApiUnavailableError('The reminders API could not be reached.')))

  expect(outcome).toBe('unavailable')
})

test('throws the error when the change fails in a way that is a bug', async () => {
  const reporting = reportOutcome(Promise.reject(new Error('Unexpected status 404.')))

  await expect(reporting).rejects.toThrow('Unexpected status 404.')
})
