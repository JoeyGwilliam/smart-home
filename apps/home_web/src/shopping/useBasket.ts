import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'

import { reportOutcome, type SaveOutcome } from '@/homeApi/homeApi'
import type { Recipe } from '@/recipes/recipe'
import type { Basket } from '@/shopping/basket'
import * as shoppingApi from '@/shopping/shoppingApi'

const BASKET_QUERY_KEY = ['basket']

// Every screen shares the basket, so each one refreshes by itself to show what the others add. A few seconds is soon
// enough for something that people fill up over minutes.
const REFRESH_INTERVAL_MILLISECONDS = 5000

/** Changes to the basket. None of them throw: each reports its outcome instead. */
export interface BasketActions {
  /** Adds one of a recipe, with its ingredients as they are now. */
  addRecipe: (recipe: Recipe) => Promise<SaveOutcome>
  /** Adds an item to buy as it is, such as "Milk". Its name must contain non-whitespace text. */
  addItem: (name: string) => Promise<SaveOutcome>
  /** Raises or lowers a line's quantity, such as by 1 or -1, taking it out if it falls to 0. */
  changeQuantity: (lineId: string, quantityChange: number) => Promise<SaveOutcome>
  removeLine: (lineId: string) => Promise<SaveOutcome>
  emptyBasket: () => Promise<SaveOutcome>
}

/**
 * Keeps this screen in step with the basket that every screen shares. Changes made on other screens appear here within
 * a few seconds.
 *
 * @returns The query, whose data is the basket.
 */
export function useBasket(): UseQueryResult<Basket> {
  return useQuery({ queryKey: BASKET_QUERY_KEY, queryFn: shoppingApi.getBasket, refetchInterval: REFRESH_INTERVAL_MILLISECONDS })
}

/**
 * Provides the changes that can be made to the basket, keeping `useBasket` in step with them.
 *
 * @returns The actions.
 */
export function useBasketActions(): BasketActions {
  const queryClient = useQueryClient()

  const changeMutation = useMutation({
    mutationFn: (sendChange: () => Promise<Basket>) => sendChange(),
    // Changes sharing a scope are sent one at a time, in order, so that each screen shows the basket after its last one.
    scope: { id: 'basket' },
    onSuccess: async (changedBasket) => {
      // Every change answers with the basket as it now is, so there's no need to ask again. A refresh that was sent
      // before this change reached the API would bring back the basket as it was.
      await queryClient.cancelQueries({ queryKey: BASKET_QUERY_KEY })
      queryClient.setQueryData(BASKET_QUERY_KEY, changedBasket)
    },
    onError: () => queryClient.invalidateQueries({ queryKey: BASKET_QUERY_KEY }),
  })

  const change = (sendChange: () => Promise<Basket>) => reportOutcome(changeMutation.mutateAsync(sendChange))

  return {
    addRecipe: (recipe) =>
      change(() =>
        shoppingApi.addToBasket({ name: recipe.name, quantity: 1, recipe: { id: recipe.id, ingredients: recipe.ingredients } }),
      ),
    addItem: (name) => change(() => shoppingApi.addToBasket({ name: name.trim(), quantity: 1, recipe: null })),
    changeQuantity: (lineId, quantityChange) => change(() => shoppingApi.changeQuantity(lineId, quantityChange)),
    removeLine: (lineId) => change(() => shoppingApi.removeFromBasket(lineId)),
    emptyBasket: () => change(shoppingApi.emptyBasket),
  }
}
