import { findRecipeLine } from '@/shopping/basket'

test('finds the line for the recipe when the recipe is in the basket', () => {
  const chilliLine = { id: 'line-2', name: 'Chilli', quantity: 2, recipe: { id: 'chilli', ingredients: ['Beans'] } }
  const basket = { lines: [{ id: 'line-1', name: 'Milk', quantity: 1, recipe: null }, chilliLine], shoppingList: [] }

  expect(findRecipeLine(basket, 'chilli')).toBe(chilliLine)
})

test('finds nothing when the recipe is not in the basket', () => {
  const basket = { lines: [{ id: 'line-1', name: 'Milk', quantity: 1, recipe: null }], shoppingList: [] }

  expect(findRecipeLine(basket, 'chilli')).toBeUndefined()
})
