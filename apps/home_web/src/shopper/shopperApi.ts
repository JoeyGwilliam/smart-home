import { sendToHomeApi } from '@/homeApi/homeApi'
import type { ShopperEvent, ShopperSettings, ShopperState, ShopperStatus } from '@/shopper/shopper'

// nginx.conf and vite.config.ts forward these to the shopper API.
const SHOPPER_URL = '/api/shopper'

// The API refuses an action while it is busy, such as a second order while one is being generated. The
// RequestRefusedError that this causes says why, in words meant for the person.

/** The status as the API sends it. Amounts of money are strings of pounds, such as "12.50". */
interface ShopperStatusJson {
  state: ShopperState
  is_logged_in: boolean
  login_failure: string | null
  trip: {
    shopping_list: { name: string; quantity: number; needed_for: string[] }[]
    model: ShopperSettings['model']
    effort: ShopperSettings['effort']
    events: ShopperEvent[]
    draft_order: {
      summary: string
      item_choices: { item: string; products: string[]; note: string }[]
      trolley: {
        lines: { name: string; quantity: number; price: string; offer: string | null }[]
        total: string
        savings: string
        shortfall_to_minimum_spend: string
      }
    } | null
  } | null
}

/**
 * Fetches what the shopper is doing, and the latest shop.
 *
 * @returns The status as it is right now.
 * @throws ApiUnavailableError If the API is unavailable, which includes it not having been started on the home server.
 */
export async function getShopperStatus(): Promise<ShopperStatus> {
  const response = await sendToHomeApi('shopper', 'GET', `${SHOPPER_URL}/status`)
  const { state, is_logged_in, login_failure, trip }: ShopperStatusJson = await response.json()
  return {
    state,
    isLoggedIn: is_logged_in,
    loginFailure: login_failure,
    trip: trip && {
      shoppingList: trip.shopping_list.map((item) => ({ name: item.name, quantity: item.quantity, neededFor: item.needed_for })),
      model: trip.model,
      effort: trip.effort,
      events: trip.events,
      draftOrder: trip.draft_order && {
        summary: trip.draft_order.summary,
        itemChoices: trip.draft_order.item_choices,
        trolley: {
          lines: trip.draft_order.trolley.lines.map((line) => ({ ...line, price: Number(line.price) })),
          total: Number(trip.draft_order.trolley.total),
          savings: Number(trip.draft_order.trolley.savings),
          shortfallToMinimumSpend: Number(trip.draft_order.trolley.shortfall_to_minimum_spend),
        },
      },
    },
  }
}

/**
 * Has Claude fill the Morrisons trolley from the shopping list as it is now, replacing whatever the trolley holds.
 * Nothing is ordered. `getShopperStatus` shows the progress.
 *
 * @param settings How Claude should shop.
 * @throws RequestRefusedError If the shopper is busy.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function generateOrder(settings: ShopperSettings): Promise<void> {
  await sendToHomeApi('shopper', 'POST', `${SHOPPER_URL}/trip`, settings)
}

/**
 * Interrupts the order being generated. Does nothing if none is. The trolley keeps whatever had been added.
 *
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function stopGeneratingOrder(): Promise<void> {
  await sendToHomeApi('shopper', 'POST', `${SHOPPER_URL}/trip/stop`)
}

/**
 * Opens a window on the home server's screen for a person to log in to their Morrisons account. Once they have, orders
 * fill the account's own trolley.
 *
 * @throws RequestRefusedError If the shopper is busy.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function logInToMorrisons(): Promise<void> {
  await sendToHomeApi('shopper', 'POST', `${SHOPPER_URL}/account/log-in`)
}

/**
 * Forgets the Morrisons login, so that orders fill a guest's trolley.
 *
 * @throws RequestRefusedError If the shopper is busy.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function logOutOfMorrisons(): Promise<void> {
  await sendToHomeApi('shopper', 'POST', `${SHOPPER_URL}/account/log-out`)
}
