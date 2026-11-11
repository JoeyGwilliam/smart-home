import { User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ASSIGNEES, type Assignee } from '@/reminders/reminder'

// The menu's radio items need a string for every choice, including nobody.
const NOBODY = 'nobody'

interface AssigneePickerProps {
  /** The person the reminder is for, or null if it is for nobody in particular. */
  value: Assignee | null
  /** Called with the new choice, or null when the reminder should be for nobody in particular. */
  onChange: (assignedTo: Assignee | null) => void
}

/** A button that opens a menu for choosing who a reminder is for, if anyone. */
export function AssigneePicker({ value, onChange }: AssigneePickerProps) {
  const chooseValue = (chosenValue: string) => onChange(chosenValue === NOBODY ? null : (chosenValue as Assignee))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-input bg-field px-4 text-sm font-semibold text-foreground hover:bg-accent"
        >
          <User className="text-primary-text" />
          {value ?? 'Nobody'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 rounded-2xl border-[3px] border-panel-edge p-1.5 shadow-xl shadow-shade">
        <DropdownMenuRadioGroup value={value ?? NOBODY} onValueChange={chooseValue} aria-label="Assigned to">
          <DropdownMenuRadioItem value={NOBODY} className="rounded-xl py-2 pl-2.5 font-semibold">
            Nobody
          </DropdownMenuRadioItem>
          {ASSIGNEES.map((assignee) => (
            <DropdownMenuRadioItem key={assignee} value={assignee} className="rounded-xl py-2 pl-2.5 font-semibold">
              {assignee}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
