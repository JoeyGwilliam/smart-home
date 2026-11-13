import { Clock, CookingPot, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Pill } from '@/components/Pill'
import { QuantityStepper } from '@/pages/shoppingList/QuantityStepper'
import { describeRecipeTime, type Recipe } from '@/recipes/recipe'
import { getPictureUrl } from '@/recipes/recipesApi'

interface RecipeTileProps {
  recipe: Recipe
  /** How many of the recipe are in the basket. 0 if it isn't in it. */
  quantityInBasket: number
  /** Called when the recipe is pressed, to put one more of it in the basket. */
  onAdd: () => void
  /** Called with 1 or -1, once the recipe is in the basket. */
  onChangeQuantity: (quantityChange: number) => void
}

/** A recipe as a big tile to press, like on a kiosk, which adds one of it to the basket each time it is pressed. */
export function RecipeTile({ recipe, quantityInBasket, onAdd, onChangeQuantity }: RecipeTileProps) {
  const isInBasket = quantityInBasket > 0

  return (
    <article
      className={`panel relative flex flex-col overflow-hidden rounded-4xl shadow-lg shadow-shade transition ${isInBasket ? 'ring-4 ring-primary' : ''}`}
    >
      <button type="button" onClick={onAdd} aria-label={`Add ${recipe.name} to the basket`} className="group text-left">
        {recipe.pictureId ? (
          <img src={getPictureUrl(recipe.pictureId)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition group-active:scale-95" />
        ) : (
          <div className="grid aspect-[4/3] place-items-center bg-secondary/60 text-secondary-foreground" aria-hidden>
            <CookingPot className="size-12 opacity-70 transition group-active:scale-90" />
          </div>
        )}
        <span className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-md shadow-shade transition group-hover:scale-110 group-active:scale-95">
          <Plus className="size-6" />
        </span>
        <AnimatePresence>
          {isInBasket && (
            <motion.span
              key={quantityInBasket}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.5, duration: 0.4 }}
              className="absolute top-3 left-3 rounded-full bg-butter px-3 py-1 text-lg font-bold text-[oklch(0.4_0.08_80)] shadow-md shadow-shade"
              aria-hidden
            >
              × {quantityInBasket}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl leading-tight font-semibold break-words">{recipe.name}</h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {recipe.timeMinutes !== null ? (
            <Pill className="bg-peach text-[oklch(0.42_0.1_40)]">
              <Clock className="size-3.5" />
              {describeRecipeTime(recipe.timeMinutes)}
            </Pill>
          ) : (
            <span />
          )}
          {isInBasket && <QuantityStepper itemName={recipe.name} quantity={quantityInBasket} onChange={onChangeQuantity} />}
        </div>
      </div>
    </article>
  )
}
