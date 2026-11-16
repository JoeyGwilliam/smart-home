import { generateOrder, getShopperStatus, logInToMorrisons, stopGeneratingOrder } from '@/shopper/shopperApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('converts the status from the API format, with amounts as numbers of pounds, when getting it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
    state: 'idle',
    is_logged_in: true,
    login_failure: null,
    trip: {
      shopping_list: [{ name: 'Milk', quantity: 1, needed_for: [] }],
      model: 'sonnet',
      effort: 'medium',
      events: [{ kind: 'activity', text: 'Searching for milk' }],
      draft_order: {
        summary: 'All found.',
        item_choices: [{ item: 'Milk', products: ['1 × Morrisons Milk 2L'], note: 'Cheapest.' }],
        trolley: {
          lines: [{ name: 'Morrisons Milk 2L', quantity: 1, price: '1.55', offer: null }],
          total: '1.55',
          savings: '0',
          shortfall_to_minimum_spend: '23.45',
        },
      },
    },
  })))

  const status = await getShopperStatus()

  expect(status).toEqual({
    state: 'idle',
    isLoggedIn: true,
    loginFailure: null,
    trip: {
      shoppingList: [{ name: 'Milk', quantity: 1, neededFor: [] }],
      model: 'sonnet',
      effort: 'medium',
      events: [{ kind: 'activity', text: 'Searching for milk' }],
      draftOrder: {
        summary: 'All found.',
        itemChoices: [{ item: 'Milk', products: ['1 × Morrisons Milk 2L'], note: 'Cheapest.' }],
        trolley: {
          lines: [{ name: 'Morrisons Milk 2L', quantity: 1, price: 1.55, offer: null }],
          total: 1.55,
          savings: 0,
          shortfallToMinimumSpend: 23.45,
        },
      },
    },
  })
})

test('posts the chosen model, effort and preferences when generating an order', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(null, { status: 202 }))
  vi.stubGlobal('fetch', fetch)

  await generateOrder({ model: 'opus', effort: 'high', preferences: 'Organic milk' })

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/shopper/trip')
  expect(request.method).toBe('POST')
  expect(JSON.parse(request.body)).toEqual({ model: 'opus', effort: 'high', preferences: 'Organic milk' })
})

test('posts to the stop address when stopping an order being generated', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await stopGeneratingOrder()

  expect(fetch).toHaveBeenCalledWith('/api/shopper/trip/stop', expect.objectContaining({ method: 'POST' }))
})

test('posts to the log-in address when logging in to Morrisons', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(null, { status: 202 }))
  vi.stubGlobal('fetch', fetch)

  await logInToMorrisons()

  expect(fetch).toHaveBeenCalledWith('/api/shopper/account/log-in', expect.objectContaining({ method: 'POST' }))
})
