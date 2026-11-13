import { sendToHomeApi } from '@/homeApi/homeApi'
import type { Basket, BasketAddition, BasketLine } from '@/shopping/basket'

// nginx.conf and vite.config.ts forward these to the shopping API.
const BASKET_URL = '/api/shopping/basket'
const LINES_URL = `${BASKET_URL}/lines`

/** The basket as the API sends it, which every request answers with. */
interface BasketJson {
  lines: BasketLine[]
  shopping_list: { name: string; quantity: number; needed_for: string[] }[]
}

/**
 * Fetches the basket.
 *
 * @returns The basket as it is now.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function getBasket(): Promise<Basket> {
  return parseBasket(await sendToHomeApi('shopping', 'GET', BASKET_URL))
}

/**
 * Adds a recipe or an item to the basket. If the basket already has a line for the same recipe, or an item with the
 * same name, ignoring capitals, that line's quantity grows instead, and it takes the addition's name and recipe.
 *
 * @param addition What to add.
 * @returns The basket as it now is.
 * @throws RequestRefusedError If the API rejects the addition, which happens when its name is blank, its quantity is
 *   less than 1, or its recipe has no ingredients.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function addToBasket(addition: BasketAddition): Promise<Basket> {
  return parseBasket(await sendToHomeApi('shopping', 'POST', LINES_URL, addition))
}

/**
 * Raises or lowers the quantity of one line of the basket, taking it out if its quantity falls to 0. Does nothing if
 * the basket has no such line. Changes made at the same time on two screens both count.
 *
 * @param lineId Identifier of the line to change.
 * @param quantityChange How much to add to its quantity, such as 1 or -1.
 * @returns The basket as it now is.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function changeQuantity(lineId: string, quantityChange: number): Promise<Basket> {
  return parseBasket(await sendToHomeApi('shopping', 'PATCH', `${LINES_URL}/${lineId}`, { quantity_change: quantityChange }))
}

/**
 * Takes a line out of the basket. Does nothing if the basket has no such line.
 *
 * @param lineId Identifier of the line to take out.
 * @returns The basket as it now is.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function removeFromBasket(lineId: string): Promise<Basket> {
  return parseBasket(await sendToHomeApi('shopping', 'DELETE', `${LINES_URL}/${lineId}`))
}

/**
 * Takes everything out of the basket.
 *
 * @returns The basket as it now is, which is empty.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function emptyBasket(): Promise<Basket> {
  return parseBasket(await sendToHomeApi('shopping', 'DELETE', LINES_URL))
}

async function parseBasket(response: Response): Promise<Basket> {
  const basketJson: BasketJson = await response.json()
  return {
    lines: basketJson.lines,
    shoppingList: basketJson.shopping_list.map((item) => ({ name: item.name, quantity: item.quantity, neededFor: item.needed_for })),
  }
}
