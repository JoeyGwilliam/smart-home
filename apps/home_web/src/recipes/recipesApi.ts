import { sendToHomeApi } from '@/homeApi/homeApi'
import type { Recipe, RecipeContent } from '@/recipes/recipe'

// nginx.conf and vite.config.ts forward these to the recipes API.
const RECIPES_URL = '/api/recipes/recipes'
const PICTURES_URL = '/api/recipes/pictures'

/** A recipe as the API sends and receives it. */
interface RecipeJson {
  id: string
  name: string
  ingredients: string[]
  instructions: string | null
  time_minutes: number | null
  picture_id: string | null
}

/**
 * Lists every recipe.
 *
 * @returns All recipes, in alphabetical order of name, ignoring capitals.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function listRecipes(): Promise<Recipe[]> {
  const response = await sendToHomeApi('recipes', 'GET', RECIPES_URL)
  const recipesJson: RecipeJson[] = await response.json()
  return recipesJson.map(parseRecipe)
}

/**
 * Creates a recipe.
 *
 * @param content What the recipe says. Its picture, if it has one, must have been uploaded with `uploadPicture`.
 * @returns The new recipe, with the id the API gave it.
 * @throws RequestRefusedError If the API rejects the content, which happens when the name, an ingredient or the
 *   instructions are blank, there are no ingredients, the time is less than a minute, or the picture isn't one that
 *   was uploaded for this recipe.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function createRecipe(content: RecipeContent): Promise<Recipe> {
  const response = await sendToHomeApi('recipes', 'POST', RECIPES_URL, formatContent(content))
  return parseRecipe(await response.json())
}

/**
 * Saves every part of a recipe, replacing what the API held. Recreates the recipe if it was deleted elsewhere. If
 * the recipe's picture has changed, the API deletes the old one.
 *
 * @param recipe The recipe as it should now be.
 * @throws RequestRefusedError If the API rejects the recipe, for the same reasons as `createRecipe`.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function saveRecipe(recipe: Recipe): Promise<void> {
  await sendToHomeApi('recipes', 'PUT', `${RECIPES_URL}/${recipe.id}`, formatContent(recipe))
}

/**
 * Ensures that a recipe and its picture no longer exist. Does nothing if the recipe doesn't exist.
 *
 * @param recipeId Identifier of the recipe to delete.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function deleteRecipe(recipeId: string): Promise<void> {
  await sendToHomeApi('recipes', 'DELETE', `${RECIPES_URL}/${recipeId}`)
}

/**
 * Uploads a picture, so that a recipe can be saved with it. Upload one only when a recipe is about to be saved with
 * it, as a picture that no recipe takes up is still kept.
 *
 * @param picture The image file, such as a photo that the person chose.
 * @returns The picture's id, for the recipe's `pictureId`.
 * @throws RequestRefusedError If the API rejects the picture, which happens when it isn't a JPEG, PNG, WebP or GIF
 *   image, or is bigger than 10 MB.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function uploadPicture(picture: Blob): Promise<string> {
  const response = await sendToHomeApi('recipes', 'POST', PICTURES_URL, picture)
  const { id }: { id: string } = await response.json()
  return id
}

/**
 * Gives the address of a recipe's picture, for an image to show. The picture at an address never changes.
 *
 * @param pictureId The recipe's `pictureId`.
 * @returns The address.
 */
export function getPictureUrl(pictureId: string): string {
  return `${PICTURES_URL}/${pictureId}`
}

function parseRecipe(recipeJson: RecipeJson): Recipe {
  return {
    id: recipeJson.id,
    name: recipeJson.name,
    ingredients: recipeJson.ingredients,
    instructions: recipeJson.instructions,
    timeMinutes: recipeJson.time_minutes,
    pictureId: recipeJson.picture_id,
  }
}

function formatContent(content: RecipeContent): Omit<RecipeJson, 'id'> {
  return {
    name: content.name,
    ingredients: content.ingredients,
    instructions: content.instructions,
    time_minutes: content.timeMinutes,
    picture_id: content.pictureId,
  }
}
