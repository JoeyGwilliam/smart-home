import { addToBasket, changeQuantity, emptyBasket, getBasket, removeFromBasket } from '@/shopping/shoppingApi'

const EMPTY_BASKET_JSON = { lines: [], shopping_list: [] }

afterEach(() => {
  vi.unstubAllGlobals()
})

test('converts the basket from the API format when getting it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
    lines: [{ id: 'line-1', name: 'Chilli', quantity: 2, recipe: { id: 'chilli', ingredients: ['Beans'] } }],
    shopping_list: [{ name: 'Beans', quantity: 2, needed_for: ['Chilli'] }],
  })))

  const basket = await getBasket()

  expect(basket).toEqual({
    lines: [{ id: 'line-1', name: 'Chilli', quantity: 2, recipe: { id: 'chilli', ingredients: ['Beans'] } }],
    shoppingList: [{ name: 'Beans', quantity: 2, neededFor: ['Chilli'] }],
  })
})

test('posts the addition to the lines when adding to the basket', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(EMPTY_BASKET_JSON))
  vi.stubGlobal('fetch', fetch)

  await addToBasket({ name: 'Chilli', quantity: 1, recipe: { id: 'chilli', ingredients: ['Beans'] } })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/shopping/basket/lines')
  expect(request.method).toBe('POST')
  expect(JSON.parse(request.body)).toEqual({ name: 'Chilli', quantity: 1, recipe: { id: 'chilli', ingredients: ['Beans'] } })
})

test('patches the line with the amount to add when changing its quantity', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(EMPTY_BASKET_JSON))
  vi.stubGlobal('fetch', fetch)

  await changeQuantity('line-1', -1)

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/shopping/basket/lines/line-1')
  expect(request.method).toBe('PATCH')
  expect(JSON.parse(request.body)).toEqual({ quantity_change: -1 })
})

test('sends a delete to the line when removing it', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(EMPTY_BASKET_JSON))
  vi.stubGlobal('fetch', fetch)

  await removeFromBasket('line-1')

  expect(fetch).toHaveBeenCalledWith('/api/shopping/basket/lines/line-1', expect.objectContaining({ method: 'DELETE' }))
})

test('sends a delete to all the lines when emptying the basket', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(EMPTY_BASKET_JSON))
  vi.stubGlobal('fetch', fetch)

  await emptyBasket()

  expect(fetch).toHaveBeenCalledWith('/api/shopping/basket/lines', expect.objectContaining({ method: 'DELETE' }))
})
