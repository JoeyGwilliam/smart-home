import { ChevronDown, Clock, CookingPot, Pencil, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { describeRecipeTime, type Recipe } from '@/recipes/recipe'
import { getPictureUrl } from '@/recipes/recipesApi'

interface RecipeCardProps {
  recipe: Recipe
  onEdit: () => void
  /** Called when the person asks to delete the recipe, before they have confirmed it. */
  onDelete: () => void
}

/**
 * A recipe's picture, name and time, which opens up to show its ingredients and instructions, so that a list of
 * recipes can be skimmed.
 */
export function RecipeCard({ recipe, onEdit, onDelete }: RecipeCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ingredientCount = recipe.ingredients.length

  return (
    <article className="panel overflow-hidden rounded-4xl shadow-lg shadow-shade">
      {recipe.pictureId ? (
        <img src={getPictureUrl(recipe.pictureId)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
      ) : (
        <div className="grid aspect-[3/1] place-items-center bg-secondary/60 text-secondary-foreground" aria-hidden>
          <CookingPot className="size-10 opacity-70" />
        </div>
      )}

      <div className="grid gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-2xl leading-tight font-semibold break-words">{recipe.name}</h2>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary" onClick={onEdit} aria-label={`Edit ${recipe.name}`}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${recipe.name}`}
          >
            <Trash2 />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {recipe.timeMinutes !== null && (
            <Pill className="bg-peach text-[oklch(0.42_0.1_40)]">
              <Clock className="size-3.5" />
              {describeRecipeTime(recipe.timeMinutes)}
            </Pill>
          )}
          <Pill className="bg-secondary text-secondary-foreground">
            {ingredientCount === 1 ? '1 ingredient' : `${ingredientCount} ingredients`}
          </Pill>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex items-center gap-1 justify-self-start rounded-full py-1 font-bold text-primary-text transition hover:opacity-80"
        >
          {isOpen ? 'Hide recipe' : 'Show recipe'}
          <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
              className="overflow-hidden"
            >
              <RecipeDetails recipe={recipe} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  )
}

function RecipeDetails({ recipe }: { recipe: Recipe }) {
  return (
    <div className="grid gap-4 pb-1">
      <section className="grid gap-1.5">
        <h3 className="text-lg font-semibold">Ingredients</h3>
        <ul className="grid list-disc gap-1 pl-6">
          {recipe.ingredients.map((ingredient, index) => (
            // Two lines of a recipe can say the same thing, so their place in the list is what tells them apart.
            <li key={index}>{ingredient}</li>
          ))}
        </ul>
      </section>
      {recipe.instructions && (
        <section className="grid gap-1.5">
          <h3 className="text-lg font-semibold">Instructions</h3>
          <p className="whitespace-pre-line">{recipe.instructions}</p>
        </section>
      )}
    </div>
  )
}
