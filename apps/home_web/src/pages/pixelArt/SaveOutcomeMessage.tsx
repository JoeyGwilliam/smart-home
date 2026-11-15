import type { SaveOutcome } from '@/homeApi/homeApi'
import { cn } from 'cn'

/** What happened to the latest attempt to change what every screen shows, and what to say if it worked. */
export interface LatestSave {
  outcome: SaveOutcome
  /** Such as "Done. Every screen now shows your drawing." */
  successMessage: string
}

/** Says what happened to the latest attempt to change what every screen shows, if there has been one. */
export function SaveOutcomeMessage({ latestSave }: { latestSave: LatestSave | null }) {
  if (latestSave === null) return null
  const { outcome, successMessage } = latestSave
  const message = {
    saved: successMessage,
    invalid: "The pixel art service wouldn't take that. Try making it a little smaller, or giving it a name.",
    unavailable: "Couldn't reach the pixel art service. Your work is still here, so try again in a moment.",
  }[outcome]
  return (
    <p role={outcome === 'saved' ? 'status' : 'alert'} className={cn('text-sm font-semibold', outcome === 'saved' ? 'text-muted-foreground' : 'text-destructive')}>
      {message}
    </p>
  )
}
