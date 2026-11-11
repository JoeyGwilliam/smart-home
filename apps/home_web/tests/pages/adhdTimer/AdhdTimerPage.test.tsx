import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AdhdTimerPage } from '@/pages/adhdTimer/AdhdTimerPage'

/** A 15 minute shower and then 20 minutes of makeup, to be ready by 17:00, as the timers API sends it. */
const NIGHT_OUT_PLAN_JSON = {
  name: '',
  end_time: '17:00:00',
  faff_multiplier: 1,
  tasks: [
    { id: 'shower', name: 'Shower', duration_minutes: 15 },
    { id: 'makeup', name: 'Doing makeup', duration_minutes: 20 },
  ],
}

const EMPTY_PLAN_JSON = { name: '', end_time: '17:00:00', faff_multiplier: 1, tasks: [] }

// What the API stand-in answers a new preset with. The page only needs it to be a preset, not to match what was sent.
const ACCEPTED_PRESET_JSON = { id: 'new', plan: { ...EMPTY_PLAN_JSON, name: 'Accepted' } }

interface StubbedApi {
  /** The active timer that the API holds. Changing it is what another screen changing the timer looks like. */
  activeTimerJson: { plan: typeof NIGHT_OUT_PLAN_JSON; started_at: string | null }
  /** The presets that the API lists. */
  presetsJson: object[]
  /** Whether requests for presets get no answer. */
  arePresetsUnreachable: boolean
  fetch: ReturnType<typeof vi.fn>
}

/**
 * Stands in for the timers API. It starts out holding the night out plan, stopped, and no presets. It keeps the active
 * timer that it is sent, and accepts every change to the presets without keeping it.
 */
function stubApi(): StubbedApi {
  const api: StubbedApi = {
    activeTimerJson: { plan: NIGHT_OUT_PLAN_JSON, started_at: null },
    presetsJson: [],
    arePresetsUnreachable: false,
    fetch: vi.fn(),
  }
  api.fetch.mockImplementation(async (url: string, request: RequestInit) => {
    if (url.endsWith('/active-timer')) {
      if (request.method === 'PUT') api.activeTimerJson = JSON.parse(request.body as string)
      return Response.json(api.activeTimerJson)
    }
    if (api.arePresetsUnreachable) throw new TypeError('Failed to fetch')
    return request.method === 'GET' ? Response.json(api.presetsJson) : Response.json(ACCEPTED_PRESET_JSON, { status: 201 })
  })
  vi.stubGlobal('fetch', api.fetch)
  return api
}

/** Sets the clock to a time of day on 11 November 2026, and keeps it running. */
function setClock(hours: number, minutes: number) {
  vi.useFakeTimers({ now: new Date(2026, 10, 11, hours, minutes), shouldAdvanceTime: true })
}

/** Stands in for the browser's speech, which jsdom doesn't have, and returns everything that is said. */
function stubSpeech(): string[] {
  const spokenTexts: string[] = []
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    text: string
    constructor(text: string) {
      this.text = text
    }
  })
  vi.stubGlobal('speechSynthesis', { speak: (utterance: { text: string }) => spokenTexts.push(utterance.text) })
  return spokenTexts
}

/** Shows the page, and waits for it to fetch the timer. */
async function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdhdTimerPage />
    </QueryClientProvider>,
  )
  await screen.findByRole('region', { name: 'Timer' })
  // Typing and clicking wait on timers, which only move when the fake clock is told to.
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

function getTaskRows() {
  return within(screen.getByRole('list', { name: 'Tasks' })).getAllByRole('listitem')
}

function getDial() {
  return screen.getByRole('img', { name: /^A timer that ends at/ })
}

let api: StubbedApi
let spokenTexts: string[]

beforeEach(() => {
  setClock(14, 0)
  api = stubApi()
  spokenTexts = stubSpeech()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('shows the current time at the top of the page when the page is open', async () => {
  setClock(14, 5)

  await renderPage()

  expect(screen.getByLabelText('Current time')).toHaveTextContent('14:05')
})

test('shows when each task has to start when the tasks are stacked back from the end time', async () => {
  await renderPage()

  const [showerRow, makeupRow] = getTaskRows()
  expect(within(showerRow).getByText('16:25')).toBeInTheDocument()
  expect(within(makeupRow).getByText('16:40')).toBeInTheDocument()
})

test('shows the end time and when to start by when the timer has not been started', async () => {
  await renderPage()

  const timer = within(screen.getByRole('region', { name: 'Timer' }))
  expect(timer.getByText('Ready by').nextElementSibling).toHaveTextContent('17:00')
  expect(timer.getByText('Start by').nextElementSibling).toHaveTextContent('16:25')
})

test('describes every task and its start time on the dial when there are tasks', async () => {
  await renderPage()

  expect(screen.getByRole('img', { name: 'A timer that ends at 17:00, Shower from 16:25, Doing makeup from 16:40' })).toBeInTheDocument()
})

test('writes the name of each task and its start time on the dial when there is room for them', async () => {
  await renderPage()

  const dial = within(getDial())
  expect(dial.getByText('Shower')).toBeInTheDocument()
  expect(dial.getByText('Doing makeup')).toBeInTheDocument()
  expect(dial.getByText('16:25')).toBeInTheDocument()
  expect(dial.getByText('16:40')).toBeInTheDocument()
})

test('cuts a name short on the dial when the task is too small a share of the ring for it', async () => {
  // 10 minutes of 100 is 36 degrees of the ring, which is room for about seven characters.
  api.activeTimerJson.plan = {
    ...NIGHT_OUT_PLAN_JSON,
    tasks: [
      { id: 'cook', name: 'Cook', duration_minutes: 90 },
      { id: 'table', name: 'Laying the table', duration_minutes: 10 },
    ],
  }

  await renderPage()

  const dial = within(getDial())
  expect(dial.queryByText('Laying the table')).not.toBeInTheDocument()
  expect(dial.getByText(/^Layin.*…$/)).toBeInTheDocument()
})

test('leaves a name off the dial when the task is a tiny share of the ring', async () => {
  api.activeTimerJson.plan = {
    ...NIGHT_OUT_PLAN_JSON,
    tasks: [
      { id: 'cook', name: 'Cook', duration_minutes: 98 },
      { id: 'keys', name: 'Keys', duration_minutes: 2 },
    ],
  }

  await renderPage()

  const dial = within(getDial())
  expect(dial.getByText('Cook')).toBeInTheDocument()
  expect(dial.queryByText('Keys')).not.toBeInTheDocument()
})

test('adds a task that ends at the end time when one is added', async () => {
  api.activeTimerJson.plan = EMPTY_PLAN_JSON
  const user = await renderPage()

  await user.type(screen.getByLabelText('New task name'), 'Shoes on')
  await user.clear(screen.getByLabelText('New task minutes'))
  await user.type(screen.getByLabelText('New task minutes'), '5')
  await user.click(screen.getByRole('button', { name: 'Add' }))

  const [shoesRow] = getTaskRows()
  expect(within(shoesRow).getByLabelText('Task 1 name')).toHaveValue('Shoes on')
  expect(within(shoesRow).getByText('16:55')).toBeInTheDocument()
})

test('sends the plan to the API for the other screens when a task is added', async () => {
  api.activeTimerJson.plan = EMPTY_PLAN_JSON
  const user = await renderPage()

  await user.type(screen.getByLabelText('New task name'), 'Shoes on')
  await user.click(screen.getByRole('button', { name: 'Add' }))

  await waitFor(() => expect(api.activeTimerJson.plan.tasks).toEqual([{ id: expect.any(String), name: 'Shoes on', duration_minutes: 10 }]))
})

test('keeps every letter when a name is typed faster than the API answers', async () => {
  const user = await renderPage()

  await user.type(screen.getByLabelText('Task 1 name'), ' and hair')

  expect(screen.getByLabelText('Task 1 name')).toHaveValue('Shower and hair')
  await waitFor(() => expect(api.activeTimerJson.plan.tasks[0].name).toBe('Shower and hair'))
})

test('starts every task earlier when the faff multiplier is doubled', async () => {
  await renderPage()

  fireEvent.change(screen.getByLabelText(/Faff multiplier/), { target: { value: '2' } })

  const [showerRow, makeupRow] = getTaskRows()
  expect(within(showerRow).getByText('15:50')).toBeInTheDocument()
  expect(within(makeupRow).getByText('16:20')).toBeInTheDocument()
  expect(within(makeupRow).getByText('→ 40 min with faff')).toBeInTheDocument()
})

test('starts the tasks earlier when one is given more minutes', async () => {
  const user = await renderPage()

  await user.clear(screen.getByLabelText('Task 2 minutes'))
  await user.type(screen.getByLabelText('Task 2 minutes'), '30')

  const [showerRow, makeupRow] = getTaskRows()
  expect(within(showerRow).getByText('16:15')).toBeInTheDocument()
  expect(within(makeupRow).getByText('16:30')).toBeInTheDocument()
})

test('swaps a task with the one after it when the down arrow key is pressed on its grip', async () => {
  const user = await renderPage()

  screen.getByRole('button', { name: /^Move Shower/ }).focus()
  await user.keyboard('{ArrowDown}')

  expect(screen.getByLabelText('Task 1 name')).toHaveValue('Doing makeup')
  expect(screen.getByLabelText('Task 2 name')).toHaveValue('Shower')
  expect(within(getTaskRows()[1]).getByText('16:45')).toBeInTheDocument()
})

test('takes a task out of the plan when it is removed', async () => {
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Remove Shower' }))

  expect(getTaskRows()).toHaveLength(1)
  expect(screen.getByLabelText('Task 1 name')).toHaveValue('Doing makeup')
})

test('shows no hand when the timer has not been started', async () => {
  await renderPage()

  expect(screen.queryByTestId('hand')).not.toBeInTheDocument()
  expect(screen.queryByTestId('elapsed-time')).not.toBeInTheDocument()
})

test('points the hand at the current time and greys out the time behind it when the timer is started', async () => {
  // 16:39 is 14 of the plan's 35 minutes after its start, which is 144 degrees of the way round.
  setClock(16, 39)
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Start' }))

  expect(screen.getByTestId('hand').style.transform).toMatch(/^rotate\(144(\.\d+)?deg\)$/)
  expect(screen.getByTestId('elapsed-time').getAttribute('stroke-dasharray')).toMatch(/^144(\.\d+)? 360$/)
})

test('tells the API that the timer has started when Start is pressed', async () => {
  setClock(16, 30)
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Start' }))

  await waitFor(() => expect(api.activeTimerJson.started_at).toMatch(/^2026-11-11T16:30/))
})

test('shows the timer running when another screen starts it', async () => {
  setClock(16, 30)
  await renderPage()

  api.activeTimerJson = { ...api.activeTimerJson, started_at: new Date(2026, 10, 11, 16, 29).toISOString() }
  await act(() => vi.advanceTimersByTimeAsync(1500))

  expect(screen.getByTestId('hand')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
})

test('shows the tasks that another screen changes when the next refresh arrives', async () => {
  await renderPage()

  api.activeTimerJson = {
    ...api.activeTimerJson,
    plan: { ...NIGHT_OUT_PLAN_JSON, tasks: [{ id: 'shower', name: 'Long bath', duration_minutes: 45 }] },
  }
  await act(() => vi.advanceTimersByTimeAsync(1500))

  expect(getTaskRows()).toHaveLength(1)
  expect(screen.getByLabelText('Task 1 name')).toHaveValue('Long bath')
  expect(screen.getByLabelText('Task 1 minutes')).toHaveValue(45)
})

test('counts down to the start of the next task when the timer is started', async () => {
  setClock(16, 30)
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Start' }))

  const timer = within(screen.getByRole('region', { name: 'Timer' }))
  expect(timer.getByText('Doing makeup in').nextElementSibling).toHaveTextContent(/^(10:00|9:5\d)$/)
  expect(timer.getByText('Now: Shower')).toBeInTheDocument()
})

test('reads out the time, the task and how long it has when the timer is started during a task', async () => {
  setClock(16, 30)
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Start' }))

  expect(spokenTexts).toEqual(["It's 4:30 PM. Time to start Shower. You have 10 minutes."])
})

test('reads out the task when another screen starts the timer during it', async () => {
  setClock(16, 30)
  await renderPage()

  api.activeTimerJson = { ...api.activeTimerJson, started_at: new Date(2026, 10, 11, 16, 29).toISOString() }
  await act(() => vi.advanceTimersByTimeAsync(1500))

  expect(spokenTexts).toEqual(["It's 4:30 PM. Time to start Shower. You have 10 minutes."])
})

test('reads out only the next task when its start time arrives on a page that loaded with the timer running', async () => {
  setClock(16, 39)
  api.activeTimerJson.started_at = new Date(2026, 10, 11, 16, 0).toISOString()
  await renderPage()

  await act(() => vi.advanceTimersByTimeAsync(61_000))

  expect(spokenTexts).toEqual(["It's 4:40 PM. Time to start Doing makeup. You have 20 minutes."])
})

test('says nothing when the start times of the tasks pass without the timer being started', async () => {
  setClock(16, 39)
  await renderPage()

  await act(() => vi.advanceTimersByTimeAsync(61_000))

  expect(spokenTexts).toEqual([])
})

test('stays finished when the end time has passed on a started timer', async () => {
  setClock(17, 30)
  api.activeTimerJson.started_at = new Date(2026, 10, 11, 16, 0).toISOString()

  await renderPage()

  expect(screen.getByText("Time's up")).toBeInTheDocument()
  expect(screen.getByTestId('elapsed-time').getAttribute('stroke-dasharray')).toBe('360 360')
})

test('takes the hand away when the timer is stopped', async () => {
  setClock(16, 30)
  api.activeTimerJson.started_at = new Date(2026, 10, 11, 16, 0).toISOString()
  const user = await renderPage()

  await user.click(screen.getByRole('button', { name: 'Stop' }))

  expect(screen.queryByTestId('hand')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
})

test('replaces the plan with a preset when the preset is loaded', async () => {
  api.presetsJson = [
    {
      id: 'abc',
      plan: { name: 'School run', end_time: '08:35:00', faff_multiplier: 1.5, tasks: [{ id: 'breakfast', name: 'Breakfast', duration_minutes: 20 }] },
    },
  ]
  const user = await renderPage()

  await user.click(await screen.findByRole('button', { name: 'Load School run' }))

  expect(screen.getByLabelText('Ready by')).toHaveValue('08:35')
  expect(screen.getByLabelText(/Faff multiplier/)).toHaveValue('1.5')
  expect(screen.getByLabelText('Timer name')).toHaveValue('School run')
  expect(getTaskRows()).toHaveLength(1)
  expect(within(getTaskRows()[0]).getByText('08:05')).toBeInTheDocument()
})

test('sends the plan to the API as a preset when it is saved under a new name', async () => {
  const user = await renderPage()

  await user.type(screen.getByLabelText('Timer name'), 'Night out')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Saved.')).toBeInTheDocument()
  const postRequest = api.fetch.mock.calls.find(([, request]) => request?.method === 'POST')?.[1]
  expect(JSON.parse(postRequest.body)).toEqual({ plan: { ...NIGHT_OUT_PLAN_JSON, name: 'Night out', end_time: '17:00' } })
})

test('does not offer saving a preset when the plan has no name', async () => {
  await renderPage()

  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('asks the API to delete a preset when deleting it is confirmed', async () => {
  api.presetsJson = [{ id: 'abc', plan: { ...EMPTY_PLAN_JSON, name: 'School run' } }]
  const user = await renderPage()

  await user.click(await screen.findByRole('button', { name: 'Delete School run' }))
  await user.click(screen.getByRole('button', { name: 'Delete' }))

  expect(api.fetch).toHaveBeenCalledWith('/api/timers/presets/abc', expect.objectContaining({ method: 'DELETE' }))
})

test('explains the problem when the presets cannot be reached', async () => {
  api.arePresetsUnreachable = true

  await renderPage()

  expect(await screen.findByText("Can't reach your presets right now.")).toBeInTheDocument()
})

test('explains the problem when the timer cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={queryClient}>
      <AdhdTimerPage />
    </QueryClientProvider>,
  )

  expect(await screen.findByRole('heading', { name: "Can't reach the timer" })).toBeInTheDocument()
})
