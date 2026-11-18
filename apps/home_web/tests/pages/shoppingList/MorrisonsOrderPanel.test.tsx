import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MorrisonsOrderPanel } from '@/pages/shoppingList/MorrisonsOrderPanel'
import { useSettings } from '@/settings/useSettings'

const NEVER_SHOPPED = { state: 'idle', is_logged_in: false, login_failure: null, trip: null }

const MILK_TRIP = {
  shopping_list: [{ name: 'Milk', quantity: 1, needed_for: [] }],
  model: 'sonnet',
  effort: 'medium',
  events: [{ kind: 'activity', text: 'Searching for milk' }],
  draft_order: null,
}

const MILK_ORDER = {
  summary: 'Everything was found.',
  item_choices: [
    { item: 'Milk', products: ['1 × Morrisons Milk 2L'], note: 'Cheapest per litre.' },
    { item: 'Saffron', products: [], note: 'None in stock.' },
  ],
  trolley: {
    lines: [{ name: 'Morrisons Milk 2L', quantity: 1, price: '1.55', offer: null }],
    total: '1.55',
    savings: '0',
    shortfall_to_minimum_spend: '23.45',
  },
}

/** Stands in for the shopper API, answering with the given status and accepting every action. */
function stubApi(status: object) {
  const fetch = vi.fn().mockImplementation(async (_url: string, request?: RequestInit) =>
    request?.method === 'POST' ? Response.json(null, { status: 202 }) : Response.json(status),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function renderPanel({ hasThingsToBuy = true } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MorrisonsOrderPanel hasThingsToBuy={hasThingsToBuy} />
    </QueryClientProvider>,
  )
}

function findPost(fetch: ReturnType<typeof stubApi>) {
  return fetch.mock.calls.find(([, request]) => request?.method === 'POST')
}

afterEach(() => {
  vi.unstubAllGlobals()
  // The chosen model, effort, preferences and past orders are remembered between tests, by the settings module and by the browser.
  const { result } = renderHook(() => useSettings())
  act(() => result.current[1]({
    shopperModel: 'sonnet',
    shopperEffort: 'medium',
    shopperPreferences: '',
    shopperPastOrderCount: 5,
  }))
  localStorage.clear()
})

test('generates the order with Sonnet at medium effort learning from the last 5 orders when nothing else has been chosen', async () => {
  const fetch = stubApi(NEVER_SHOPPED)
  renderPanel()

  await userEvent.click(await screen.findByRole('button', { name: 'Generate order' }))

  const [url, request] = findPost(fetch)!
  expect(url).toBe('/api/shopper/trip')
  expect(JSON.parse(request.body)).toEqual({ model: 'sonnet', effort: 'medium', preferences: '', past_order_count: 5 })
})

test('generates the order with the chosen model and effort when they have been changed', async () => {
  const fetch = stubApi(NEVER_SHOPPED)
  renderPanel()

  await userEvent.selectOptions(await screen.findByLabelText('Model'), 'Opus')
  await userEvent.selectOptions(screen.getByLabelText('Effort'), 'High')
  await userEvent.click(screen.getByRole('button', { name: 'Generate order' }))

  expect(JSON.parse(findPost(fetch)![1].body)).toMatchObject({ model: 'opus', effort: 'high' })
})

test('generates the order with the preferences that were written when there are some', async () => {
  const fetch = stubApi(NEVER_SHOPPED)
  renderPanel()

  await userEvent.type(await screen.findByLabelText('Preferences'), 'Free-range eggs only')
  await userEvent.click(screen.getByRole('button', { name: 'Generate order' }))

  expect(JSON.parse(findPost(fetch)![1].body)).toMatchObject({ preferences: 'Free-range eggs only' })
})

test('remembers the preferences when the page is opened again', async () => {
  stubApi(NEVER_SHOPPED)
  renderPanel()
  await userEvent.type(await screen.findByLabelText('Preferences'), 'No own-brand cereal')
  cleanup()

  renderPanel()

  expect(await screen.findByLabelText('Preferences')).toHaveValue('No own-brand cereal')
})

test('generates the order learning from the chosen number of past orders when one has been chosen', async () => {
  const fetch = stubApi(NEVER_SHOPPED)
  renderPanel()

  await userEvent.selectOptions(await screen.findByLabelText('Past orders'), 'Last 10')
  await userEvent.click(screen.getByRole('button', { name: 'Generate order' }))

  expect(JSON.parse(findPost(fetch)![1].body)).toMatchObject({ past_order_count: 10 })
})

test('generates the order without past orders when None has been chosen', async () => {
  const fetch = stubApi(NEVER_SHOPPED)
  renderPanel()

  await userEvent.selectOptions(await screen.findByLabelText('Past orders'), 'None')
  await userEvent.click(screen.getByRole('button', { name: 'Generate order' }))

  expect(JSON.parse(findPost(fetch)![1].body)).toMatchObject({ past_order_count: 0 })
})

test('remembers the number of past orders when the page is opened again', async () => {
  stubApi(NEVER_SHOPPED)
  renderPanel()
  await userEvent.selectOptions(await screen.findByLabelText('Past orders'), 'Last 3')
  cleanup()

  renderPanel()

  expect(await screen.findByLabelText('Past orders')).toHaveDisplayValue('Last 3')
})

test('cannot generate an order when the basket has nothing to buy', async () => {
  stubApi(NEVER_SHOPPED)

  renderPanel({ hasThingsToBuy: false })

  expect(await screen.findByRole('button', { name: 'Generate order' })).toBeDisabled()
})

test('shows progress and a stop button when Claude is shopping', async () => {
  const fetch = stubApi({ ...NEVER_SHOPPED, state: 'shopping', trip: MILK_TRIP })
  renderPanel()

  expect(await screen.findByText('Searching for milk')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))

  expect(findPost(fetch)![0]).toBe('/api/shopper/trip/stop')
})

test('shows the total and what was chosen for each item when the order is ready', async () => {
  stubApi({ ...NEVER_SHOPPED, trip: { ...MILK_TRIP, draft_order: MILK_ORDER } })

  renderPanel()

  // The total is a paragraph of its own, unlike the price of each product in the trolley.
  expect(await screen.findByText('£1.55', { selector: 'p' })).toBeInTheDocument()
  expect(screen.getByText('Add £23.45 more to reach Morrisons\' minimum spend for delivery.')).toBeInTheDocument()
  expect(screen.getByText('1 × Morrisons Milk 2L')).toBeInTheDocument()
  expect(screen.getByText('Nothing bought')).toBeInTheDocument()
})

test('links to Morrisons to check out when the order is ready in a logged-in account', async () => {
  stubApi({ ...NEVER_SHOPPED, is_logged_in: true, trip: { ...MILK_TRIP, draft_order: MILK_ORDER } })

  renderPanel()

  expect(await screen.findByRole('link', { name: 'Open Morrisons to check out' })).toHaveAttribute('href', 'https://groceries.morrisons.com/basket')
})

test('says why when the order could not be generated', async () => {
  const failedTrip = { ...MILK_TRIP, events: [...MILK_TRIP.events, { kind: 'failure', text: 'Usage limit reached.' }] }
  stubApi({ ...NEVER_SHOPPED, trip: failedTrip })

  renderPanel()

  expect(await screen.findByRole('alert')).toHaveTextContent('Usage limit reached.')
})

test('opens the login window when Log in is pressed', async () => {
  const fetch = stubApi(NEVER_SHOPPED)
  renderPanel()

  await userEvent.click(await screen.findByRole('button', { name: 'Log in' }))

  expect(findPost(fetch)![0]).toBe('/api/shopper/account/log-in')
})

test('says where to log in when the login window is open', async () => {
  stubApi({ ...NEVER_SHOPPED, state: 'logging_in' })

  renderPanel()

  expect(await screen.findByText(/A Morrisons window is open on the home server's screen/)).toBeInTheDocument()
})

test('says the shopper is not reachable when it has not been started', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))

  renderPanel()

  expect(await screen.findByText(/The Morrisons shopper isn't reachable/)).toBeInTheDocument()
})
