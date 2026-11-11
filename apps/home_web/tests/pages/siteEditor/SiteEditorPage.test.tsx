import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SiteEditorPage } from '@/pages/siteEditor/SiteEditorPage'
import { useSettings } from '@/settings/useSettings'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SiteEditorPage />
    </QueryClientProvider>,
  )
}

/**
 * Stands in for the site editor API. It answers with the given change and commits, and answers every action with
 * `actionResponse`, which accepts the action unless another response is given.
 */
function stubApi({ change, commits = [], actionResponse = () => Response.json(null, { status: 202 }) }: {
  change: { state: string; events: { kind: string; text: string }[]; changed_files: string[] }
  commits?: { hash: string; subject: string; author: string; committed_at: string }[]
  actionResponse?: () => Response
}) {
  const fetch = vi.fn().mockImplementation(async (url: string, request?: RequestInit) => {
    if (request?.method === 'POST') return actionResponse()
    return Response.json(url.endsWith('/commits') ? commits : change)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** Finds the addresses that the page has posted to, without the part that every address of the API shares. */
function listActions(fetch: ReturnType<typeof stubApi>): string[] {
  return fetch.mock.calls
    .filter(([, request]) => request?.method === 'POST')
    .map(([url]) => url.replace('/api/site-editor/change/', ''))
}

afterEach(() => {
  vi.unstubAllGlobals()
  // The chosen model and effort are remembered between tests, by the settings module and by the browser.
  const { result } = renderHook(() => useSettings())
  act(() => result.current[1]({ claudeModel: 'default', claudeEffort: 'default' }))
  localStorage.clear()
})

test('asks what to change when no change is being made', async () => {
  stubApi({ change: { state: 'idle', events: [], changed_files: [] } })

  renderPage()

  expect(await screen.findByPlaceholderText('What would you like to change?')).toBeEnabled()
})

test('sends the message and empties the box when a message is sent', async () => {
  const fetch = stubApi({ change: { state: 'idle', events: [], changed_files: [] } })
  renderPage()

  await userEvent.type(await screen.findByLabelText('Message'), 'Make the clock bigger')
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))

  const [, request] = fetch.mock.calls.find(([, request]) => request?.method === 'POST')!
  expect(JSON.parse(request.body)).toEqual({ text: 'Make the clock bigger', model: null, effort: null })
  expect(screen.getByLabelText('Message')).toHaveValue('')
})

test('sends the chosen model and effort when a message is sent', async () => {
  const fetch = stubApi({ change: { state: 'idle', events: [], changed_files: [] } })
  renderPage()

  await userEvent.selectOptions(await screen.findByLabelText('Model'), 'Sonnet')
  await userEvent.selectOptions(screen.getByLabelText('Effort'), 'Extra high')
  await userEvent.type(screen.getByLabelText('Message'), 'Make the clock bigger')
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))

  const [, request] = fetch.mock.calls.find(([, request]) => request?.method === 'POST')!
  expect(JSON.parse(request.body)).toEqual({ text: 'Make the clock bigger', model: 'sonnet', effort: 'xhigh' })
})

test('sends the message when Enter is pressed', async () => {
  const fetch = stubApi({ change: { state: 'idle', events: [], changed_files: [] } })
  renderPage()

  await userEvent.type(await screen.findByLabelText('Message'), 'Make the clock bigger{Enter}')

  expect(listActions(fetch)).toEqual(['messages'])
})

test('explains the refusal and keeps the text when a message is refused', async () => {
  stubApi({
    change: { state: 'idle', events: [], changed_files: [] },
    actionResponse: () => Response.json({ detail: "The site's files have changes that weren't made here." }, { status: 409 }),
  })
  renderPage()

  await userEvent.type(await screen.findByLabelText('Message'), 'Make the clock bigger')
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))

  expect(await screen.findByText("The site's files have changes that weren't made here.")).toBeInTheDocument()
  expect(screen.getByLabelText('Message')).toHaveValue('Make the clock bigger')
})

test('shows the conversation when Claude has made progress', async () => {
  stubApi({
    change: {
      state: 'working',
      events: [
        { kind: 'request', text: 'Make the clock bigger' },
        { kind: 'thinking', text: '' },
        { kind: 'activity', text: 'Editing ClockCard.tsx' },
        { kind: 'reply', text: 'The clock is now twice the size.' },
      ],
      changed_files: [],
    },
  })

  renderPage()

  const conversation = within(await screen.findByRole('list', { name: 'Conversation' }))
  expect(conversation.getByText('Make the clock bigger')).toBeInTheDocument()
  expect(conversation.getByText('Thinking…')).toBeInTheDocument()
  expect(conversation.getByText('Editing ClockCard.tsx')).toBeInTheDocument()
  expect(conversation.getByText('The clock is now twice the size.')).toBeInTheDocument()
})

test('says that Claude is working and disables the message box when Claude is working', async () => {
  stubApi({ change: { state: 'working', events: [{ kind: 'request', text: 'Make the clock bigger' }], changed_files: [] } })

  renderPage()

  expect(await screen.findByRole('status')).toHaveTextContent('Claude is working…')
  expect(screen.getByLabelText('Message')).toBeDisabled()
})

test('stops Claude when Stop is pressed', async () => {
  const fetch = stubApi({ change: { state: 'working', events: [{ kind: 'request', text: 'Make the clock bigger' }], changed_files: [] } })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Stop' }))

  expect(listActions(fetch)).toEqual(['stop'])
})

test('lists the changed files when a change is being reviewed', async () => {
  stubApi({
    change: { state: 'reviewing', events: [{ kind: 'request', text: 'Make the clock bigger' }], changed_files: ['src/ClockCard.tsx'] },
  })

  renderPage()

  expect(await screen.findByText('1 changed file')).toBeInTheDocument()
  expect(screen.getByText('src/ClockCard.tsx')).toBeInTheDocument()
})

test('confirms the change when Keep it is pressed', async () => {
  const fetch = stubApi({
    change: { state: 'reviewing', events: [{ kind: 'request', text: 'Make the clock bigger' }], changed_files: ['src/ClockCard.tsx'] },
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Keep it' }))

  expect(listActions(fetch)).toEqual(['confirm'])
})

test('discards the change when Discard it is pressed', async () => {
  const fetch = stubApi({
    change: { state: 'reviewing', events: [{ kind: 'request', text: 'Make the clock bigger' }], changed_files: ['src/ClockCard.tsx'] },
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Discard it' }))

  expect(listActions(fetch)).toEqual(['discard'])
})

test('offers to end the conversation but not to keep anything when Claude changed no files', async () => {
  stubApi({
    change: {
      state: 'discussing',
      events: [{ kind: 'request', text: 'Make it bigger' }, { kind: 'reply', text: 'Which part?' }],
      changed_files: [],
    },
  })

  renderPage()

  expect(await screen.findByRole('button', { name: 'End the conversation' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Keep it' })).not.toBeInTheDocument()
})

test('shows what went wrong when a step fails', async () => {
  stubApi({
    change: {
      state: 'discussing',
      events: [{ kind: 'request', text: 'Make the clock bigger' }, { kind: 'failure', text: 'The preview could not be built.' }],
      changed_files: ['src/ClockCard.tsx'],
    },
  })

  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('The preview could not be built.')
})

test('shows each saved change with the start of its hash when the site has history', async () => {
  stubApi({
    change: { state: 'idle', events: [], changed_files: [] },
    commits: [{ hash: 'db5d509aa1b2c3', subject: 'remove redundant icon', author: 'Joey', committed_at: '2026-11-10T18:30:00Z' }],
  })

  renderPage()

  const history = within(await screen.findByRole('region', { name: 'History' }))
  expect(history.getByText('remove redundant icon')).toBeInTheDocument()
  expect(history.getByText('db5d509')).toBeInTheDocument()
})

test('explains the problem when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  renderPage()

  expect(await screen.findByRole('region', { name: "Can't reach the site editor" })).toBeInTheDocument()
})

test('links to the rescue page when a change might have broken the site', async () => {
  stubApi({ change: { state: 'idle', events: [], changed_files: [] } })

  renderPage()

  expect(await screen.findByRole('link', { name: 'rescue page' })).toHaveAttribute('href', '/api/site-editor/rescue')
})
