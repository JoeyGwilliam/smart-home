import { CloudOff, CookingPot } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { Pill } from '@/components/Pill'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { SaveOutcome } from '@/homeApi/homeApi'
import { BasketPanel } from '@/pages/shoppingList/BasketPanel'
import { RecipeTile } from '@/pages/shoppingList/RecipeTile'
import type { Recipe } from '@/recipes/recipe'
import { useRecipes } from '@/recipes/useRecipes'
import { findRecipeLine, type Basket } from '@/shopping/basket'
import { useBasket, useBasketActions } from '@/shopping/useBasket'

/**
 * Fills the home's shopping basket, like a kiosk: every recipe is a tile that adds one of it each time it is pressed,
 * and the basket beside them takes items of one's own too, and shows everything that it adds up to buying.
 */
export function ShoppingListPage() {
  const recipesQuery = useRecipes()
  const basketQuery = useBasket()
  const actions = useBasketActions()
  const [hasChangeFailed, setHasChangeFailed] = useState(false)
  const [isConfirmingEmpty, setIsConfirmingEmpty] = useState(false)

  const reportChange = async (change: Promise<SaveOutcome>): Promise<boolean> => {
    const isSaved = (await change) === 'saved'
    setHasChangeFailed(!isSaved)
    return isSaved
  }

  const basket = basketQuery.data
  const lineCount = basket?.lines.length ?? 0

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-10 sm:pb-14">
      <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">Shopping list</h1>
        <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2">
          {basket && (
            <Pill className="bg-secondary text-secondary-foreground">
              {lineCount === 0 ? 'Basket is empty' : lineCount === 1 ? '1 thing in the basket' : `${lineCount} things in the basket`}
            </Pill>
          )}
        </div>
      </motion.header>

      {hasChangeFailed && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          Couldn't reach your shopping basket to change it. Try again in a moment.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="Recipes" className="grid gap-4">
          <h2 className="text-2xl font-semibold">Recipes</h2>
          <RecipeTiles
            recipes={recipesQuery.data}
            basket={basket}
            hasFetchFailed={recipesQuery.isError}
            onRetry={() => void recipesQuery.refetch()}
            onAdd={(recipe) => void reportChange(actions.addRecipe(recipe))}
            onChangeQuantity={(lineId, change) => void reportChange(actions.changeQuantity(lineId, change))}
          />
        </section>

        <div className="lg:sticky lg:top-4">
          {basket ? (
            <BasketPanel
              basket={basket}
              onAddItem={(name) => reportChange(actions.addItem(name))}
              onChangeQuantity={(lineId, change) => void reportChange(actions.changeQuantity(lineId, change))}
              onRemove={(lineId) => void reportChange(actions.removeLine(lineId))}
              onEmpty={() => setIsConfirmingEmpty(true)}
            />
          ) : basketQuery.isError ? (
            <UnavailableNotice title="Can't reach your basket" body="The shopping service isn't responding. Try again in a moment." onRetry={() => void basketQuery.refetch()} />
          ) : (
            <div className="h-64 animate-pulse rounded-4xl bg-field" aria-label="Loading the basket" />
          )}
        </div>
      </div>

      <AlertDialog open={isConfirmingEmpty} onOpenChange={setIsConfirmingEmpty}>
        <AlertDialogContent className="rounded-4xl border-[3px] border-panel-edge bg-popover/95 p-6 shadow-2xl shadow-shade">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold">Empty the basket?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">Everything in it will be taken out, on every screen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-full px-5 font-bold">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void reportChange(actions.emptyBasket())}
              className="h-10 rounded-full bg-destructive px-5 font-bold text-white hover:bg-destructive/90"
            >
              Empty it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

interface RecipeTilesProps {
  /** Every recipe, or undefined while none have been fetched. */
  recipes: Recipe[] | undefined
  /** The basket, or undefined while it hasn't been fetched. Until it has, no recipe shows as being in it. */
  basket: Basket | undefined
  hasFetchFailed: boolean
  onRetry: () => void
  onAdd: (recipe: Recipe) => void
  onChangeQuantity: (lineId: string, quantityChange: number) => void
}

function RecipeTiles({ recipes, basket, hasFetchFailed, onRetry, onAdd, onChangeQuantity }: RecipeTilesProps) {
  if (!recipes) {
    return hasFetchFailed ? (
      <UnavailableNotice title="Can't reach your recipes" body="The recipes service isn't responding. Try again in a moment." onRetry={onRetry} />
    ) : (
      <div className="h-40 animate-pulse rounded-4xl bg-field" aria-label="Loading recipes" />
    )
  }
  if (recipes.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-primary/50 bg-field/50 px-6 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-primary/60 text-primary-foreground">
          <CookingPot className="size-8" />
        </span>
        <p className="font-heading text-2xl font-semibold">No recipes yet</p>
        <p className="text-muted-foreground">Add some on the Recipes page, and they'll show up here to shop for.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {recipes.map((recipe) => {
        const line = basket && findRecipeLine(basket, recipe.id)
        return (
          <RecipeTile
            key={recipe.id}
            recipe={recipe}
            quantityInBasket={line?.quantity ?? 0}
            onAdd={() => onAdd(recipe)}
            onChangeQuantity={(change) => line && onChangeQuantity(line.id, change)}
          />
        )
      })}
    </div>
  )
}

function UnavailableNotice({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <div className="panel grid place-items-center gap-3 rounded-3xl px-6 py-12 text-center shadow-md shadow-shade">
      <span className="grid size-16 place-items-center rounded-full bg-lavender text-secondary-foreground">
        <CloudOff className="size-8" />
      </span>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="max-w-sm text-muted-foreground">{body}</p>
      <Button onClick={onRetry} className="mt-2 h-10 rounded-full px-6 font-bold shadow-md shadow-shade">
        Try again
      </Button>
    </div>
  )
}
