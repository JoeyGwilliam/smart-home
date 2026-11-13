import type { SaveOutcome } from '@/homeApi/homeApi'
import type { Recipe } from '@/recipes/recipe'
import type { RecipeToSave } from '@/recipes/useRecipes'

/** A recipe while someone is writing it, in the form the fields hold it. */
export interface RecipeDraft {
  name: string
  /** One ingredient to each line. Blank lines are ignored. */
  ingredients: string
  /** Empty when there are no instructions. */
  instructions: string
  /** The time in minutes, as typed. Empty when there is no estimate. */
  timeMinutes: string
  /** The id of the picture the recipe already has, an image file chosen to replace it, or null for no picture. */
  picture: string | Blob | null
}

/**
 * Creates a draft to edit.
 *
 * @param recipe The recipe to start from. Defaults to an empty one.
 * @returns The draft.
 */
export function createDraft(recipe?: Recipe): RecipeDraft {
  return {
    name: recipe?.name ?? '',
    ingredients: recipe?.ingredients.join('\n') ?? '',
    instructions: recipe?.instructions ?? '',
    timeMinutes: recipe?.timeMinutes?.toString() ?? '',
    picture: recipe?.pictureId ?? null,
  }
}

/**
 * Whether a draft can be saved. The recipes API rejects a recipe without a name or ingredients, or whose time isn't a
 * whole number of minutes, so this lets a form stop that before sending it.
 */
export function isDraftComplete(draft: RecipeDraft): boolean {
  return draft.name.trim() !== '' && splitIngredients(draft.ingredients).length > 0 && isTimeValid(draft.timeMinutes)
}

/**
 * Converts a complete draft into a recipe to save, tidying away surrounding whitespace.
 *
 * @param draft The draft, which `isDraftComplete` accepts.
 * @param recipeId The id of the recipe that the draft edits, or null if it is a new recipe.
 * @returns The recipe to save, with blank instructions and time treated as none.
 */
export function toRecipeToSave(draft: RecipeDraft, recipeId: string | null): RecipeToSave {
  return {
    id: recipeId,
    name: draft.name.trim(),
    ingredients: splitIngredients(draft.ingredients),
    instructions: draft.instructions.trim() || null,
    timeMinutes: draft.timeMinutes.trim() === '' ? null : Number(draft.timeMinutes),
    picture: draft.picture,
  }
}

/**
 * Explains to the person why saving a recipe didn't work.
 *
 * @param outcome How saving went, other than being saved.
 * @returns What to tell them.
 */
export function describeSaveFailure(outcome: Exclude<SaveOutcome, 'saved'>): string {
  return outcome === 'invalid'
    ? "That recipe couldn't be saved. Check that its picture is a photo no bigger than 10 MB."
    : "Couldn't reach your recipes. Your recipe is still here, so try again in a moment."
}

function splitIngredients(ingredients: string): string[] {
  return ingredients
    .split('\n')
    .map((ingredient) => ingredient.trim())
    .filter((ingredient) => ingredient !== '')
}

function isTimeValid(timeMinutes: string): boolean {
  if (timeMinutes.trim() === '') return true
  const minutes = Number(timeMinutes)
  return Number.isInteger(minutes) && minutes >= 1
}
