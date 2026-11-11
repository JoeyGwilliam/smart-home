import { Repeat as RepeatIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { REPEAT_DESCRIPTIONS } from '@/reminders/describeRepeat'
import type { Repeat } from '@/reminders/reminder'

// The menu's radio items need a string for every choice, including not repeating.
const NO_REPEAT = 'never'

interface RepeatPickerProps {
  /** How often the reminder repeats, or null if it happens once. */
  value: Repeat | null
  /** Called with the new choice, or null when the reminder should happen once. */
  onChange: (repeats: Repeat | null) => void
}

/** A button that opens a menu for choosing how often a reminder repeats, if at all. */
export function RepeatPicker({ value, onChange }: RepeatPickerProps) {
  const chooseValue = (chosenValue: string) => onChange(chosenValue === NO_REPEAT ? null : (chosenValue as Repeat))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-input bg-field px-4 text-sm font-semibold text-foreground hover:bg-accent"
        >
          <RepeatIcon className="text-primary-text" />
          {value ? REPEAT_DESCRIPTIONS[value] : "Doesn't repeat"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 rounded-2xl border-[3px] border-panel-edge p-1.5 shadow-xl shadow-shade">
        <DropdownMenuRadioGroup value={value ?? NO_REPEAT} onValueChange={chooseValue} aria-label="Repeat">
          <DropdownMenuRadioItem value={NO_REPEAT} className="rounded-xl py-2 pl-2.5 font-semibold">
            Doesn't repeat
          </DropdownMenuRadioItem>
          {Object.entries(REPEAT_DESCRIPTIONS).map(([repeat, description]) => (
            <DropdownMenuRadioItem key={repeat} value={repeat} className="rounded-xl py-2 pl-2.5 font-semibold">
              {description}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
