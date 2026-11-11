import type { AssigneeFilter } from '@/reminders/filterByAssignee'
import { ASSIGNEES } from '@/reminders/reminder'
import { cn } from 'cn'

const CHOICES: { filter: AssigneeFilter; label: string }[] = [
  { filter: 'everyone', label: 'Everyone' },
  ...ASSIGNEES.map((assignee) => ({ filter: assignee, label: assignee })),
]

interface AssigneeFilterBarProps {
  value: AssigneeFilter
  onChange: (filter: AssigneeFilter) => void
}

/** A row of buttons for choosing whose reminders to show. */
export function AssigneeFilterBar({ value, onChange }: AssigneeFilterBarProps) {
  return (
    <div role="group" aria-label="Show reminders for" className="flex flex-wrap gap-2">
      {CHOICES.map(({ filter, label }) => (
        <button
          key={filter}
          type="button"
          aria-pressed={value === filter}
          onClick={() => onChange(filter)}
          className={cn(
            'h-10 rounded-full px-4 text-sm font-bold transition-colors',
            value === filter ? 'bg-primary text-primary-foreground shadow-md shadow-shade' : 'bg-field text-foreground hover:bg-accent',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
