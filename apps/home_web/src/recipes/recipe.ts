/** Something to cook, held by the recipes API, for the recipes page and any page that plans meals or shopping. */
export interface Recipe {
  /** Unique identifier that stays the same when the recipe is edited. */
  id: string
  /** What the dish is called, such as "Shepherd's pie". Always contains non-whitespace text. */
  name: string
  /**
   * What goes in it, one ingredient to each item, such as "500g lamb mince", in the order the recipe lists them.
   * There is always at least one, and each contains non-whitespace text.
   */
  ingredients: string[]
  /** How to make it, or null if the recipe doesn't say. */
  instructions: string | null
  /** Roughly how long it takes to make, in whole minutes, or null if nobody has estimated it. At least 1. */
  timeMinutes: number | null
  /** Identifier of the recipe's picture, or null if it has none. `getPictureUrl` in recipesApi turns it into an address. */
  pictureId: string | null
}

/** The parts of a recipe that a person writes, as opposed to its identity. */
export type RecipeContent = Omit<Recipe, 'id'>

/**
 * Describes roughly how long a recipe takes, for people to read.
 *
 * @param minutes The time in whole minutes. At least 1.
 * @returns The time, such as "45 min", "1 hr" or "1 hr 30 min".
 */
export function describeRecipeTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes} min`
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`
}
