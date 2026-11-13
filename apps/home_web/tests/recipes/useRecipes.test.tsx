import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useRecipeActions, useRecipes } from '@/recipes/useRecipes'

const BEANS_ON_TOAST_JSON = { id: 'abc', name: 'Beans on toast', ingredients: ['Beans'], instructions: null, time_minutes: null, picture_id: null }

/** Answers every list request with "Beans on toast", every picture upload with the id "pic", and every other change with the given response. */
function stubApi(answerChange: () => Response) {
  const fetch = vi.fn().mockImplementation((url: string, request?: RequestInit) => {
    if (request?.method === 'GET') return Promise.resolve(Response.json([BEANS_ON_TOAST_JSON]))
    if (url === '/api/recipes/pictures') return Promise.resolve(Response.json({ id: 'pic' }, { status: 201 }))
    return Promise.resolve(answerChange())
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function renderRecipeHooks() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => ({ query: useRecipes(), actions: useRecipeActions() }), { wrapper })
  await waitFor(() => expect(result.current.query.data).toBeDefined())
  return result
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('creates a recipe when it has no id', async () => {
  const fetch = stubApi(() => Response.json({ ...BEANS_ON_TOAST_JSON, id: 'def' }, { status: 201 }))
  const hooks = await renderRecipeHooks()

  const outcome = await act(() =>
    hooks.current.actions.saveRecipe({ id: null, name: 'Cheese on toast', ingredients: ['Cheese'], instructions: null, timeMinutes: null, picture: null }),
  )

  expect(outcome).toBe('saved')
  expect(fetch).toHaveBeenCalledWith('/api/recipes/recipes', expect.objectContaining({ method: 'POST' }))
})

test('replaces the recipe keeping its picture when it has an id and a stored picture', async () => {
  const fetch = stubApi(() => Response.json({}))
  const hooks = await renderRecipeHooks()

  await act(() =>
    hooks.current.actions.saveRecipe({ id: 'abc', name: 'Beans on toast', ingredients: ['Beans'], instructions: null, timeMinutes: null, picture: 'old-pic' }),
  )

  const putRequest = fetch.mock.calls.find(([, request]) => request?.method === 'PUT')
  expect(putRequest?.[0]).toBe('/api/recipes/recipes/abc')
  expect(JSON.parse(putRequest?.[1].body).picture_id).toBe('old-pic')
  expect(fetch).not.toHaveBeenCalledWith('/api/recipes/pictures', expect.anything())
})

test('uploads the picture first and saves the recipe with it when the picture is a new file', async () => {
  const fetch = stubApi(() => Response.json({}))
  const hooks = await renderRecipeHooks()
  const photo = new Blob(['photo'], { type: 'image/jpeg' })

  await act(() =>
    hooks.current.actions.saveRecipe({ id: 'abc', name: 'Beans on toast', ingredients: ['Beans'], instructions: null, timeMinutes: null, picture: photo }),
  )

  const putRequest = fetch.mock.calls.find(([, request]) => request?.method === 'PUT')
  expect(JSON.parse(putRequest?.[1].body).picture_id).toBe('pic')
})

test('reports that the recipe is invalid when the API rejects it', async () => {
  stubApi(() => new Response(null, { status: 422 }))
  const hooks = await renderRecipeHooks()

  const outcome = await act(() =>
    hooks.current.actions.saveRecipe({ id: null, name: 'Cheese on toast', ingredients: ['Cheese'], instructions: null, timeMinutes: null, picture: null }),
  )

  expect(outcome).toBe('invalid')
})

test('reports that the API is unavailable when deleting fails to reach it', async () => {
  stubApi(() => new Response(null, { status: 502 }))
  const hooks = await renderRecipeHooks()

  const outcome = await act(() => hooks.current.actions.deleteRecipe('abc'))

  expect(outcome).toBe('unavailable')
})
