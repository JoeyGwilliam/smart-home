import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useBasket, useBasketActions } from '@/shopping/useBasket'

const MILK_LINE_JSON = { id: 'line-1', name: 'Milk', quantity: 1, recipe: null }

/** Answers getting the basket with an empty one, and every change with the given response. */
function stubApi(answerChange: () => Response) {
  const fetch = vi.fn().mockImplementation((_url: string, request?: RequestInit) =>
    Promise.resolve(request?.method === 'GET' ? Response.json({ lines: [], shopping_list: [] }) : answerChange()),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function renderBasketHooks() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => ({ query: useBasket(), actions: useBasketActions() }), { wrapper })
  await waitFor(() => expect(result.current.query.data).toBeDefined())
  return result
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the basket that the API answers with when a change is saved', async () => {
  stubApi(() => Response.json({ lines: [MILK_LINE_JSON], shopping_list: [{ name: 'Milk', quantity: 1, needed_for: [] }] }))
  const hooks = await renderBasketHooks()

  const outcome = await act(() => hooks.current.actions.addItem('Milk'))

  expect(outcome).toBe('saved')
  await waitFor(() => expect(hooks.current.query.data?.lines).toEqual([MILK_LINE_JSON]))
})

test('sends one of the recipe with its ingredients when adding a recipe', async () => {
  const fetch = stubApi(() => Response.json({ lines: [], shopping_list: [] }))
  const hooks = await renderBasketHooks()
  const chilli = { id: 'chilli', name: 'Chilli', ingredients: ['Beans', 'Rice'], instructions: null, timeMinutes: null, pictureId: null }

  await act(() => hooks.current.actions.addRecipe(chilli))

  const postRequest = fetch.mock.calls.find(([, request]) => request?.method === 'POST')
  expect(JSON.parse(postRequest?.[1].body)).toEqual({ name: 'Chilli', quantity: 1, recipe: { id: 'chilli', ingredients: ['Beans', 'Rice'] } })
})

test('sends the item without surrounding whitespace when adding an item', async () => {
  const fetch = stubApi(() => Response.json({ lines: [], shopping_list: [] }))
  const hooks = await renderBasketHooks()

  await act(() => hooks.current.actions.addItem('  Milk '))

  const postRequest = fetch.mock.calls.find(([, request]) => request?.method === 'POST')
  expect(JSON.parse(postRequest?.[1].body)).toEqual({ name: 'Milk', quantity: 1, recipe: null })
})

test('reports that the API is unavailable when a change fails to reach it', async () => {
  stubApi(() => new Response(null, { status: 502 }))
  const hooks = await renderBasketHooks()

  const outcome = await act(() => hooks.current.actions.emptyBasket())

  expect(outcome).toBe('unavailable')
})
