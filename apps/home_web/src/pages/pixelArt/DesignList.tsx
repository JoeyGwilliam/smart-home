import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from 'cn'

/** One entry of a design list. */
export interface DesignListItem {
  id: string
  name: string
  /** The name for screen readers, when the shown name only makes sense under its heading, such as "Rain" under "Day". */
  accessibleName?: string
  /** Such as "Changed", or undefined to say nothing. */
  state?: string
}

interface DesignListProps {
  /** Names the list, such as "Scenes". */
  label: string
  groups: { title: string; items: DesignListItem[] }[]
  chosenId: string
  onChoose: (id: string) => void
  /** Names the button that makes a new one, such as "Make a new scene". */
  createLabel: string
  onCreate: () => void
}

/** A list of scenes or layers, in groups, for choosing one to work on, with a way to make a new one. */
export function DesignList({ label, groups, chosenId, onChoose, createLabel, onCreate }: DesignListProps) {
  return (
    <nav aria-label={label} className="panel grid content-start gap-4 rounded-3xl p-4 shadow-md shadow-shade lg:max-h-[80vh] lg:overflow-y-auto">
      <Button variant="outline" onClick={onCreate} className="h-10 justify-start rounded-xl font-bold">
        <Plus />
        {createLabel}
      </Button>
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.title} className="grid gap-1">
            <h2 className="px-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">{group.title}</h2>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === chosenId}
                aria-label={item.accessibleName && (item.state ? `${item.accessibleName}, ${item.state.toLowerCase()}` : item.accessibleName)}
                onClick={() => onChoose(item.id)}
                className={cn('grid rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-muted', item.id === chosenId && 'bg-secondary text-secondary-foreground hover:bg-secondary')}
              >
                <span className="text-sm leading-tight font-semibold">{item.name}</span>
                {item.state && <span className="text-xs text-muted-foreground">{item.state}</span>}
              </button>
            ))}
          </section>
        ))}
    </nav>
  )
}
