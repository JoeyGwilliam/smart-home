import {
  ActionRefusedError,
  confirmChange,
  discardChange,
  getChange,
  listCommits,
  sendMessage,
  SiteEditorUnavailableError,
  stopClaude,
} from '@/siteEditor/siteEditorApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('converts the change from the API format when getting it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
    state: 'reviewing',
    events: [{ kind: 'request', text: 'Make the clock bigger' }],
    changed_files: ['apps/home_web/src/pages/dashboard/ClockCard.tsx'],
  })))

  const change = await getChange()

  expect(change).toEqual({
    state: 'reviewing',
    events: [{ kind: 'request', text: 'Make the clock bigger' }],
    changedFiles: ['apps/home_web/src/pages/dashboard/ClockCard.tsx'],
  })
})

test('posts the text with the chosen model and effort when sending a message', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(null, { status: 202 }))
  vi.stubGlobal('fetch', fetch)

  await sendMessage('Make the clock bigger', { model: 'opus', effort: 'xhigh' })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/site-editor/change/messages')
  expect(request.method).toBe('POST')
  expect(JSON.parse(request.body)).toEqual({ text: 'Make the clock bigger', model: 'opus', effort: 'xhigh' })
})

test('posts no model or effort when sending a message with both left as the default', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(null, { status: 202 }))
  vi.stubGlobal('fetch', fetch)

  await sendMessage('Make the clock bigger', { model: 'default', effort: 'default' })

  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ text: 'Make the clock bigger', model: null, effort: null })
})

test('posts to the stop address when stopping Claude', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await stopClaude()

  expect(fetch).toHaveBeenCalledWith('/api/site-editor/change/stop', expect.objectContaining({ method: 'POST' }))
})

test('posts to the confirm address when confirming the change', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(null, { status: 202 }))
  vi.stubGlobal('fetch', fetch)

  await confirmChange()

  expect(fetch).toHaveBeenCalledWith('/api/site-editor/change/confirm', expect.objectContaining({ method: 'POST' }))
})

test('posts to the discard address when discarding the change', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(null, { status: 202 }))
  vi.stubGlobal('fetch', fetch)

  await discardChange()

  expect(fetch).toHaveBeenCalledWith('/api/site-editor/change/discard', expect.objectContaining({ method: 'POST' }))
})

test('converts commits from the API format when listing them', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
    { hash: 'db5d509aa1', subject: 'remove redundant icon', author: 'Joey', committed_at: '2026-11-10T18:30:00+00:00' },
  ])))

  const commits = await listCommits()

  expect(commits).toEqual([
    { hash: 'db5d509aa1', subject: 'remove redundant icon', author: 'Joey', committedAt: new Date('2026-11-10T18:30:00Z') },
  ])
})

test('throws ActionRefusedError with the reason when the API answers 409', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'The site editor is busy. Wait for it to finish.' }, { status: 409 })))

  const sending = sendMessage('Make the clock bigger', { model: 'default', effort: 'default' })

  await expect(sending).rejects.toThrow(ActionRefusedError)
  await expect(sending).rejects.toThrow('The site editor is busy. Wait for it to finish.')
})

test('throws SiteEditorUnavailableError when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  await expect(getChange()).rejects.toThrow(SiteEditorUnavailableError)
})

test('throws SiteEditorUnavailableError when the API is not running behind nginx', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))

  await expect(getChange()).rejects.toThrow(SiteEditorUnavailableError)
})
