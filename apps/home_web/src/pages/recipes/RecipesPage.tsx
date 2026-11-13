import { CloudOff, CookingPot, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { RecipeCard } from '@/pages/recipes/RecipeCard'
import { RecipeDialog } from '@/pages/recipes/RecipeDialog'
import type { Recipe } from '@/recipes/recipe'
import { useRecipeActions, useRecipes } from '@/recipes/useRecipes'

/** Which recipe the dialog is writing: a new one, an existing one, or none while the dialog is closed. */
type RecipeBeingWritten = { kind: 'new' } | { kind: 'existing'; recipe: Recipe } | null

/** Every recipe, each with its picture, ingredients and instructions, and a way to add more, edit them and delete them. */
export function RecipesPage() {
  const recipesQuery = useRecipes()
  const { deleteRecipe } = useRecipeActions()
  const [recipeBeingWritten, setRecipeBeingWritten] = useState<RecipeBeingWritten>(null)
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null)
  const [hasDeleteFailed, setHasDeleteFailed] = useState(false)

  const deleteChosenRecipe = async (recipe: Recipe) => {
    setHasDeleteFailed((await deleteRecipe(recipe.id)) !== 'saved')
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 pb-10 sm:pb-14">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">Recipes</h1>
          <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2">
            {recipesQuery.data && (
              <Pill className="bg-secondary text-secondary-foreground">
                {recipesQuery.data.length === 1 ? '1 recipe' : `${recipesQuery.data.length} recipes`}
              </Pill>
            )}
          </div>
        </div>
        <Button onClick={() => setRecipeBeingWritten({ kind: 'new' })} className="h-11 rounded-full px-5 text-base font-bold shadow-md shadow-shade">
          <Plus />
          Add a recipe
        </Button>
      </motion.header>

      {hasDeleteFailed && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          Couldn't reach your recipes to delete that one. Try again in a moment.
        </p>
      )}

      <RecipeList
        recipes={recipesQuery.data}
        hasFetchFailed={recipesQuery.isError}
        onRetry={() => void recipesQuery.refetch()}
        onEdit={(recipe) => setRecipeBeingWritten({ kind: 'existing', recipe })}
        onDelete={setRecipeToDelete}
      />

      <RecipeDialog
        recipe={recipeBeingWritten?.kind === 'existing' ? recipeBeingWritten.recipe : null}
        isOpen={recipeBeingWritten !== null}
        onOpenChange={(isOpen) => !isOpen && setRecipeBeingWritten(null)}
      />
      <ConfirmDeleteDialog
        question="Delete this recipe?"
        itemName={recipeToDelete?.name ?? ''}
        isOpen={recipeToDelete !== null}
        onOpenChange={(isOpen) => !isOpen && setRecipeToDelete(null)}
        onConfirm={() => recipeToDelete && void deleteChosenRecipe(recipeToDelete)}
      />
    </main>
  )
}

interface RecipeListProps {
  /** Every recipe, or undefined while none have been fetched. */
  recipes: Recipe[] | undefined
  /** Whether the latest attempt to fetch the recipes failed. */
  hasFetchFailed: boolean
  onRetry: () => void
  onEdit: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
}

function RecipeList({ recipes, hasFetchFailed, onRetry, onEdit, onDelete }: RecipeListProps) {
  if (!recipes) {
    return hasFetchFailed ? <UnavailableNotice onRetry={onRetry} /> : <div className="h-40 animate-pulse rounded-4xl bg-field" aria-label="Loading recipes" />
  }
  if (recipes.length === 0) return <EmptyState />

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onEdit={() => onEdit(recipe)} onDelete={() => onDelete(recipe)} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-primary/50 bg-field/50 px-6 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-primary/60 text-primary-foreground">
        <CookingPot className="size-8" />
      </span>
      <p className="font-heading text-2xl font-semibold">No recipes yet</p>
      <p className="text-muted-foreground">Add the dishes you make, so they're all in one place.</p>
    </div>
  )
}

function UnavailableNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="panel grid place-items-center gap-3 rounded-3xl px-6 py-12 text-center shadow-md shadow-shade">
      <span className="grid size-16 place-items-center rounded-full bg-lavender text-secondary-foreground">
        <CloudOff className="size-8" />
      </span>
      <h2 className="text-2xl font-semibold">Can't reach your recipes</h2>
      <p className="max-w-sm text-muted-foreground">The recipes service isn't responding. Your recipes are safe, so try again in a moment.</p>
      <Button onClick={onRetry} className="mt-2 h-10 rounded-full px-6 font-bold shadow-md shadow-shade">
        Try again
      </Button>
    </div>
  )
}
