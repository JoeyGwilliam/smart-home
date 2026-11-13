import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ShoppingListPage } from '@/pages/shoppingList/ShoppingListPage'

const CHILLI_JSON = { id: 'chilli', name: 'Chilli', ingredients: ['Beans', 'Rice'], instructions: null, time_minutes: 45, picture_id: null }

/** Answers the recipes API with the given recipes, getting the basket with the given basket, and every change to the basket with an empty one. */
function stubApi({ recipesJson, basketJson }: { recipesJson: object[]; basketJson: object }) {
  const fetch = vi.fn().mockImplementation((url: string, request?: RequestInit) => {
    if (url.startsWith('/api/recipes')) return Promise.resolve(Response.json(recipesJson))
    if (request?.method === 'GET') return Promise.resolve(Response.json(basketJson))
    return Promise.resolve(Response.json({ lines: [], shopping_list: [] }))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ShoppingListPage />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

function findRequest(fetch: ReturnType<typeof stubApi>, method: string) {
  return fetch.mock.calls.find(([, request]) => request?.method === method)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('adds one of the recipe with its ingredients when its tile is pressed', async () => {
  const fetch = stubApi({ recipesJson: [CHILLI_JSON], basketJson: { lines: [], shopping_list: [] } })
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: 'Add Chilli to the basket' }))

  const postRequest = findRequest(fetch, 'POST')
  expect(postRequest?.[0]).toBe('/api/shopping/basket/lines')
  expect(JSON.parse(postRequest?.[1].body)).toEqual({ name: 'Chilli', quantity: 1, recipe: { id: 'chilli', ingredients: ['Beans', 'Rice'] } })
})

test('shows how many of a recipe are in the basket when it is already there', async () => {
  stubApi({
    recipesJson: [CHILLI_JSON],
    basketJson: { lines: [{ id: 'line-1', name: 'Chilli', quantity: 3, recipe: { id: 'chilli', ingredients: ['Beans', 'Rice'] } }], shopping_list: [] },
  })

  renderPage()

  expect(await screen.findAllByLabelText('3 of Chilli')).toHaveLength(2)
})

test('sends the item to the basket when one of the person\'s own is added', async () => {
  const fetch = stubApi({ recipesJson: [], basketJson: { lines: [], shopping_list: [] } })
  const user = renderPage()

  await user.type(await screen.findByLabelText('Item to add'), 'Milk{Enter}')

  expect(JSON.parse(findRequest(fetch, 'POST')?.[1].body)).toEqual({ name: 'Milk', quantity: 1, recipe: null })
})

test('lowers the quantity of the line by one when its minus button is pressed', async () => {
  const fetch = stubApi({ recipesJson: [], basketJson: { lines: [{ id: 'line-1', name: 'Milk', quantity: 2, recipe: null }], shopping_list: [] } })
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: 'One fewer Milk' }))

  const patchRequest = findRequest(fetch, 'PATCH')
  expect(patchRequest?.[0]).toBe('/api/shopping/basket/lines/line-1')
  expect(JSON.parse(patchRequest?.[1].body)).toEqual({ quantity_change: -1 })
})

test('shows everything to buy and what it is for when the shopping list is opened', async () => {
  stubApi({
    recipesJson: [],
    basketJson: {
      lines: [{ id: 'line-1', name: 'Chilli', quantity: 2, recipe: { id: 'chilli', ingredients: ['Beans'] } }],
      shopping_list: [{ name: 'Beans', quantity: 2, needed_for: ['Chilli'] }],
    },
  })
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: 'Show what to buy (1 thing)' }))

  expect(screen.getByText('Beans')).toBeInTheDocument()
  expect(screen.getByText('for Chilli')).toBeInTheDocument()
})

test('empties the basket when emptying it is confirmed', async () => {
  const fetch = stubApi({ recipesJson: [], basketJson: { lines: [{ id: 'line-1', name: 'Milk', quantity: 1, recipe: null }], shopping_list: [] } })
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: 'Empty basket' }))
  await user.click(screen.getByRole('button', { name: 'Empty it' }))

  expect(fetch).toHaveBeenCalledWith('/api/shopping/basket/lines', expect.objectContaining({ method: 'DELETE' }))
})

test('explains the problem when the shopping API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
    url.startsWith('/api/recipes') ? Promise.resolve(Response.json([])) : Promise.reject(new TypeError('Failed to fetch')),
  ))

  renderPage()

  expect(await screen.findByRole('heading', { name: "Can't reach your basket" })).toBeInTheDocument()
})
