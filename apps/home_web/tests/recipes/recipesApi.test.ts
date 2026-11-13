import { RequestRefusedError } from '@/homeApi/homeApi'
import { createRecipe, deleteRecipe, getPictureUrl, listRecipes, saveRecipe, uploadPicture } from '@/recipes/recipesApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('converts recipes from the API format when listing them', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
    { id: 'abc', name: 'Shepherd\'s pie', ingredients: ['Lamb mince', 'Potatoes'], instructions: 'Bake it.', time_minutes: 90, picture_id: 'pic' },
  ])))

  const recipes = await listRecipes()

  expect(recipes).toEqual([
    { id: 'abc', name: 'Shepherd\'s pie', ingredients: ['Lamb mince', 'Potatoes'], instructions: 'Bake it.', timeMinutes: 90, pictureId: 'pic' },
  ])
})

test('posts the content in the API format when creating a recipe', async () => {
  const recipeJson = { id: 'abc', name: 'Beans on toast', ingredients: ['Beans'], instructions: null, time_minutes: 5, picture_id: null }
  const fetch = vi.fn().mockResolvedValue(Response.json(recipeJson, { status: 201 }))
  vi.stubGlobal('fetch', fetch)

  await createRecipe({ name: 'Beans on toast', ingredients: ['Beans'], instructions: null, timeMinutes: 5, pictureId: null })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/recipes/recipes')
  expect(request.method).toBe('POST')
  expect(JSON.parse(request.body)).toEqual({ name: 'Beans on toast', ingredients: ['Beans'], instructions: null, time_minutes: 5, picture_id: null })
})

test('puts the recipe at its own address when saving it', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}))
  vi.stubGlobal('fetch', fetch)

  await saveRecipe({ id: 'abc', name: 'Beans on toast', ingredients: ['Beans'], instructions: null, timeMinutes: null, pictureId: 'pic' })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/recipes/recipes/abc')
  expect(request.method).toBe('PUT')
  expect(JSON.parse(request.body)).toEqual({ name: 'Beans on toast', ingredients: ['Beans'], instructions: null, time_minutes: null, picture_id: 'pic' })
})

test('sends a delete to the recipe address when deleting a recipe', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await deleteRecipe('abc')

  expect(fetch).toHaveBeenCalledWith('/api/recipes/recipes/abc', expect.objectContaining({ method: 'DELETE' }))
})

test('returns the id the API gave the picture when uploading it', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'pic' }, { status: 201 }))
  vi.stubGlobal('fetch', fetch)
  const picture = new Blob(['photo'], { type: 'image/jpeg' })

  const pictureId = await uploadPicture(picture)

  expect(pictureId).toBe('pic')
  expect(fetch).toHaveBeenCalledWith('/api/recipes/pictures', expect.objectContaining({ method: 'POST', body: picture }))
})

test('throws RequestRefusedError when the API refuses the picture', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: "A recipe's picture must be a JPEG, PNG, WebP or GIF image." }, { status: 422 })))

  const uploading = uploadPicture(new Blob(['%PDF'], { type: 'application/pdf' }))

  await expect(uploading).rejects.toBeInstanceOf(RequestRefusedError)
})

test('gives the address under the pictures when giving the address of a picture', () => {
  expect(getPictureUrl('pic')).toBe('/api/recipes/pictures/pic')
})
