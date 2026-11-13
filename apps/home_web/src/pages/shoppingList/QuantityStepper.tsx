import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface QuantityStepperProps {
  /** What the quantity is of, for people using a screen reader, such as "Milk". */
  itemName: string
  quantity: number
  /** Called with 1 or -1. Lowering a quantity of 1 takes the thing out of the basket. */
  onChange: (quantityChange: number) => void
}

/** A quantity between buttons that lower and raise it, big enough to press on a touch screen. */
export function QuantityStepper({ itemName, quantity, onChange }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-secondary p-1 text-secondary-foreground">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-full hover:bg-background/60"
        onClick={() => onChange(-1)}
        aria-label={quantity === 1 ? `Take ${itemName} out` : `One fewer ${itemName}`}
      >
        <Minus />
      </Button>
      <span className="min-w-6 text-center text-lg font-bold tabular-nums" aria-label={`${quantity} of ${itemName}`}>
        {quantity}
      </span>
      <Button variant="ghost" size="icon" className="size-9 rounded-full hover:bg-background/60" onClick={() => onChange(1)} aria-label={`One more ${itemName}`}>
        <Plus />
      </Button>
    </div>
  )
}
