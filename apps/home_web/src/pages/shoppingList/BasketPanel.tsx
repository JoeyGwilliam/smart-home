import { CookingPot, Plus, ShoppingBasket, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QuantityStepper } from '@/pages/shoppingList/QuantityStepper'
import type { Basket, BasketLine } from '@/shopping/basket'

interface BasketPanelProps {
  basket: Basket
  /** Adds an item to buy as it is. Resolves to whether it was added, so that the field is only cleared once it is. */
  onAddItem: (name: string) => Promise<boolean>
  /** Called with a line's id and 1 or -1. */
  onChangeQuantity: (lineId: string, quantityChange: number) => void
  onRemove: (lineId: string) => void
  /** Called when the person asks to empty the basket, before they have confirmed it. */
  onEmpty: () => void
}

/** The basket: a field for adding items of one's own, everything in it with its quantity, and everything that it adds up to buying. */
export function BasketPanel({ basket, onAddItem, onChangeQuantity, onRemove, onEmpty }: BasketPanelProps) {
  return (
    <section aria-label="Basket" className="panel grid gap-5 rounded-4xl p-5 shadow-lg shadow-shade">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <ShoppingBasket className="size-6" />
          Basket
        </h2>
        {basket.lines.length > 0 && (
          <Button variant="ghost" onClick={onEmpty} className="h-9 rounded-full px-4 font-bold hover:bg-destructive/10 hover:text-destructive">
            Empty basket
          </Button>
        )}
      </div>

      <AddItemForm onAddItem={onAddItem} />

      {basket.lines.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-primary/50 bg-field/50 px-4 py-6 text-center text-muted-foreground">
          Your basket is empty. Press a recipe to add it, or add an item of your own above.
        </p>
      ) : (
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {basket.lines.map((line) => (
              <motion.li
                key={line.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                className="overflow-hidden"
              >
                <BasketLineRow line={line} onChangeQuantity={(change) => onChangeQuantity(line.id, change)} onRemove={() => onRemove(line.id)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {basket.shoppingList.length > 0 && <ShoppingListSummary basket={basket} />}
    </section>
  )
}

function AddItemForm({ onAddItem }: { onAddItem: (name: string) => Promise<boolean> }) {
  const [itemName, setItemName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const canAdd = itemName.trim() !== '' && !isAdding

  const addItem = async (event: FormEvent) => {
    event.preventDefault()
    if (!canAdd) return
    setIsAdding(true)
    if (await onAddItem(itemName)) setItemName('')
    setIsAdding(false)
  }

  return (
    <form onSubmit={addItem} className="flex gap-2">
      <Input
        value={itemName}
        onChange={(event) => setItemName(event.target.value)}
        aria-label="Item to add"
        placeholder="Add an item, such as milk"
        className="h-11 rounded-full border-input bg-field px-4 text-base"
      />
      <Button type="submit" disabled={!canAdd} className="h-11 rounded-full px-4 font-bold shadow-md shadow-shade">
        <Plus />
        Add
      </Button>
    </form>
  )
}

interface BasketLineRowProps {
  line: BasketLine
  onChangeQuantity: (quantityChange: number) => void
  onRemove: () => void
}

function BasketLineRow({ line, onChangeQuantity, onRemove }: BasketLineRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-field/70 py-2 pr-2 pl-4">
      <div className="min-w-0 flex-1">
        <p className="font-bold break-words">{line.name}</p>
        {line.recipe && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <CookingPot className="size-3.5" />
            {line.recipe.ingredients.length === 1 ? '1 ingredient' : `${line.recipe.ingredients.length} ingredients`}
          </p>
        )}
      </div>
      <QuantityStepper itemName={line.name} quantity={line.quantity} onChange={onChangeQuantity} />
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
        aria-label={`Remove ${line.name}`}
      >
        <X />
      </Button>
    </div>
  )
}

/** Everything that the basket adds up to buying, which is what a shopper will be asked to buy. */
function ShoppingListSummary({ basket }: { basket: Basket }) {
  const [isOpen, setIsOpen] = useState(false)
  const itemCount = basket.shoppingList.length

  return (
    <div className="grid gap-2 border-t border-border/60 pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="justify-self-start rounded-full py-1 font-bold text-primary-text transition hover:opacity-80"
      >
        {isOpen ? 'Hide what to buy' : `Show what to buy (${itemCount === 1 ? '1 thing' : `${itemCount} things`})`}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
            className="grid gap-1.5 overflow-hidden"
          >
            {basket.shoppingList.map((item) => (
              <li key={item.name} className="flex gap-2">
                <span className="min-w-8 font-bold tabular-nums">{item.quantity} ×</span>
                <span className="min-w-0 flex-1 break-words">
                  {item.name}
                  {item.neededFor.length > 0 && <span className="block text-sm text-muted-foreground">for {item.neededFor.join(', ')}</span>}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
