import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'

import { reportOutcome, type SaveOutcome } from '@/homeApi/homeApi'
import type { Recipe, RecipeContent } from '@/recipes/recipe'
import * as recipesApi from '@/recipes/recipesApi'

const RECIPES_QUERY_KEY = ['recipes']

/** A recipe to be saved: either a new one or an existing one, with the picture it should have. */
export interface RecipeToSave extends Omit<RecipeContent, 'pictureId'> {
  /** The id of the recipe to replace, or null to create a new one. */
  id: string | null
  /** The id of a picture the recipe already has, to keep it; an image file to upload and use in its place; or null for no picture. */
  picture: string | Blob | null
}

/** Changes to recipes. None of them throw: each reports its outcome instead. */
export interface RecipeActions {
  /** Creates or replaces a recipe, uploading its new picture first if it has one. */
  saveRecipe: (recipe: RecipeToSave) => Promise<SaveOutcome>
  /** Deletes a recipe, and its picture. */
  deleteRecipe: (recipeId: string) => Promise<SaveOutcome>
}

/**
 * Fetches every recipe. Recipes rarely change, so they are fetched when a page first uses them and after each change
 * made here, rather than on a timer.
 *
 * @returns The query, whose data is every recipe, in alphabetical order of name.
 */
export function useRecipes(): UseQueryResult<Recipe[]> {
  return useQuery({ queryKey: RECIPES_QUERY_KEY, queryFn: recipesApi.listRecipes })
}

/**
 * Provides the changes that can be made to recipes, keeping `useRecipes` in step with them.
 *
 * @returns The actions.
 */
export function useRecipeActions(): RecipeActions {
  const queryClient = useQueryClient()

  // Every change refetches afterwards, whatever its outcome, so that the screen always settles on what the API holds.
  const refetchRecipes = () => queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY })

  const saveMutation = useMutation({
    mutationFn: async ({ id, picture, ...content }: RecipeToSave) => {
      const pictureId = picture instanceof Blob ? await recipesApi.uploadPicture(picture) : picture
      if (id === null) {
        await recipesApi.createRecipe({ ...content, pictureId })
      } else {
        await recipesApi.saveRecipe({ ...content, pictureId, id })
      }
    },
    onSettled: refetchRecipes,
  })

  const deleteMutation = useMutation({
    mutationFn: recipesApi.deleteRecipe,
    onSettled: refetchRecipes,
  })

  return {
    saveRecipe: (recipe) => reportOutcome(saveMutation.mutateAsync(recipe)),
    deleteRecipe: (recipeId) => reportOutcome(deleteMutation.mutateAsync(recipeId)),
  }
}
