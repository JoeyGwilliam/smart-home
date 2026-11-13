import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RecipesPage } from '@/pages/recipes/RecipesPage'

const SHEPHERDS_PIE_JSON = {
  id: 'abc',
  name: "Shepherd's pie",
  ingredients: ['500g lamb mince', '1kg potatoes'],
  instructions: 'Brown the mince, then top with mash and bake.',
  time_minutes: 90,
  picture_id: 'pic',
}

/** Answers every list request with the given recipes, every picture upload with the id "new-pic", and every other change with success. */
function stubApi(recipesJson: object[]) {
  const fetch = vi.fn().mockImplementation((url: string, request?: RequestInit) => {
    if (!request?.method || request.method === 'GET') return Promise.resolve(Response.json(recipesJson))
    if (url === '/api/recipes/pictures') return Promise.resolve(Response.json({ id: 'new-pic' }, { status: 201 }))
    if (request.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
    return Promise.resolve(Response.json({ ...SHEPHERDS_PIE_JSON, ...JSON.parse(request.body as string) }, { status: 201 }))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RecipesPage />
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

test('shows each recipe with its picture and time when the API has recipes', async () => {
  stubApi([SHEPHERDS_PIE_JSON])

  renderPage()

  expect(await screen.findByRole('heading', { name: "Shepherd's pie" })).toBeInTheDocument()
  expect(screen.getByText('1 hr 30 min')).toBeInTheDocument()
  expect(screen.getByText('2 ingredients')).toBeInTheDocument()
  expect(document.querySelector('img')).toHaveAttribute('src', '/api/recipes/pictures/pic')
})

test('shows the ingredients and instructions when a recipe is opened', async () => {
  stubApi([SHEPHERDS_PIE_JSON])
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: 'Show recipe' }))

  expect(screen.getByText('500g lamb mince')).toBeInTheDocument()
  expect(screen.getByText('Brown the mince, then top with mash and bake.')).toBeInTheDocument()
})

test('shows the empty state when there are no recipes', async () => {
  stubApi([])

  renderPage()

  expect(await screen.findByText('No recipes yet')).toBeInTheDocument()
})

test('explains the problem when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  renderPage()

  expect(await screen.findByRole('heading', { name: "Can't reach your recipes" })).toBeInTheDocument()
})

test('sends the new recipe to the API when one is added with only a name and ingredients', async () => {
  const fetch = stubApi([])
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: 'Add a recipe' }))
  await user.type(screen.getByLabelText('Name'), 'Beans on toast')
  await user.type(screen.getByLabelText('Ingredients'), 'Beans{Enter}Toast')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(JSON.parse(findRequest(fetch, 'POST')?.[1].body)).toEqual({
    name: 'Beans on toast',
    ingredients: ['Beans', 'Toast'],
    instructions: null,
    time_minutes: null,
    picture_id: null,
  })
})

test('does not offer saving a new recipe when it has no ingredients', async () => {
  stubApi([])
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: 'Add a recipe' }))
  await user.type(screen.getByLabelText('Name'), 'Beans on toast')

  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('uploads the chosen picture and saves the recipe with it when a picture is added', async () => {
  const fetch = stubApi([])
  const user = renderPage()
  const photo = new File(['photo'], 'beans.jpg', { type: 'image/jpeg' })

  await user.click(await screen.findByRole('button', { name: 'Add a recipe' }))
  await user.type(screen.getByLabelText('Name'), 'Beans on toast')
  await user.type(screen.getByLabelText('Ingredients'), 'Beans')
  await user.type(screen.getByLabelText('Time in minutes'), '10')
  await user.upload(screen.getByLabelText('Choose a picture'), photo)
  expect(await screen.findByAltText("The recipe's picture")).toHaveAttribute('src', expect.stringMatching(/^data:image\/jpeg/))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(fetch).toHaveBeenCalledWith('/api/recipes/pictures', expect.objectContaining({ method: 'POST', body: photo }))
  const recipePost = fetch.mock.calls.find(([url, request]) => url === '/api/recipes/recipes' && request?.method === 'POST')
  expect(JSON.parse(recipePost?.[1].body)).toMatchObject({ time_minutes: 10, picture_id: 'new-pic' })
})

test('saves the edited recipe at its own address when a recipe is edited', async () => {
  const fetch = stubApi([SHEPHERDS_PIE_JSON])
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: "Edit Shepherd's pie" }))
  await user.clear(screen.getByLabelText('Name'))
  await user.type(screen.getByLabelText('Name'), 'Cottage pie')
  await user.click(screen.getByRole('button', { name: 'Remove picture' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const putRequest = findRequest(fetch, 'PUT')
  expect(putRequest?.[0]).toBe('/api/recipes/recipes/abc')
  expect(JSON.parse(putRequest?.[1].body)).toEqual({
    name: 'Cottage pie',
    ingredients: ['500g lamb mince', '1kg potatoes'],
    instructions: 'Brown the mince, then top with mash and bake.',
    time_minutes: 90,
    picture_id: null,
  })
})

test('asks the API to delete a recipe when deleting it is confirmed', async () => {
  const fetch = stubApi([SHEPHERDS_PIE_JSON])
  const user = renderPage()

  await user.click(await screen.findByRole('button', { name: "Delete Shepherd's pie" }))
  await user.click(screen.getByRole('button', { name: 'Delete' }))

  expect(fetch).toHaveBeenCalledWith('/api/recipes/recipes/abc', expect.objectContaining({ method: 'DELETE' }))
})
