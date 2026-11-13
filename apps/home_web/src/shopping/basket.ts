/**
 * The home's one shopping basket, held by the shopping API and shared by every screen: recipes to buy the ingredients
 * for, and items to buy as they are. A shopper can be asked to buy its `shoppingList`.
 */
export interface Basket {
  /** Everything in the basket, in the order it was first added. No two lines are for the same thing. */
  lines: BasketLine[]
  /**
   * Everything to buy, worked out by the shopping API from the lines: each recipe's ingredients, as many times over as
   * its quantity, and each item, with things that are written the same bought together.
   */
  shoppingList: ShoppingListItem[]
}

/** One thing in the basket: either a recipe, whose ingredients are to be bought, or an item to buy as it is. */
export interface BasketLine {
  /** Unique identifier that stays the same as the quantity changes. */
  id: string
  /** The recipe's name, or the item itself, such as "Milk". */
  name: string
  /** How many of the dish to buy for, or how many of the item to buy. At least 1. */
  quantity: number
  /** The recipe that the line is for, as it was when it was last added, or null if it is an item to buy as it is. */
  recipe: BasketRecipe | null
}

/** The recipe that a line of the basket is for. The basket keeps its own copy, so it still says what to buy if the recipe changes. */
export interface BasketRecipe {
  /** The recipe's id in the recipes API. */
  id: string
  /** What one of the dish needs, one ingredient to each item. */
  ingredients: string[]
}

/** Something to buy. */
export interface ShoppingListItem {
  /** What to buy, as the recipe or the person wrote it, such as "500g lamb mince". */
  name: string
  /** How many of it to buy. At least 1. */
  quantity: number
  /** The names of the recipes in the basket that need it. Empty if it was only added as an item of its own. */
  neededFor: string[]
}

/** Something to add to the basket. If the basket already has a line for the same thing, that line's quantity grows instead. */
export interface BasketAddition {
  /** The recipe's name, or the item to buy. Must contain non-whitespace text. */
  name: string
  /** How many to add. At least 1. */
  quantity: number
  /** The recipe to buy the ingredients for, or null for an item to buy as it is. */
  recipe: BasketRecipe | null
}

/**
 * Finds the line of the basket for a recipe.
 *
 * @param basket The basket to look in.
 * @param recipeId The recipe's id in the recipes API.
 * @returns The recipe's line, or undefined if the recipe isn't in the basket.
 */
export function findRecipeLine(basket: Basket, recipeId: string): BasketLine | undefined {
  return basket.lines.find((line) => line.recipe?.id === recipeId)
}
