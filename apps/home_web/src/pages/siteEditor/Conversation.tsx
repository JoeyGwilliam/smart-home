import { Brain, LoaderCircle, TriangleAlert, Wrench } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { isBusy, type Change, type ChangeState, type ProgressEvent } from '@/siteEditor/change'

/** What the site editor is in the middle of, for each state in which it is busy. */
const BUSY_MESSAGES: Partial<Record<ChangeState, string>> = {
  working: 'Claude is working…',
  building: 'Rebuilding the site…',
  saving: 'Saving the change…',
}

/**
 * The conversation about a change: what was asked for, and what Claude thought, did and said about it, as it happens.
 * It scrolls to keep the latest progress in view.
 */
export function Conversation({ change }: { change: Change }) {
  const endRef = useRef<HTMLLIElement>(null)
  const eventCount = change.events.length

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [eventCount, change.state])

  return (
    <ol className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1" aria-label="Conversation">
      {change.events.map((event, index) => (
        // Events are only ever added to the end, so an event's position identifies it.
        <li key={index}>
          <EventLine event={event} />
        </li>
      ))}
      {isBusy(change.state) && (
        <li className="flex items-center gap-2 font-bold text-primary-text" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {BUSY_MESSAGES[change.state]}
        </li>
      )}
      <li ref={endRef} aria-hidden />
    </ol>
  )
}

function EventLine({ event }: { event: ProgressEvent }) {
  switch (event.kind) {
    case 'request':
      return (
        <p className="ml-auto w-fit max-w-[85%] rounded-3xl bg-primary px-4 py-2 font-semibold whitespace-pre-wrap text-primary-foreground">
          {event.text}
        </p>
      )
    case 'reply':
      return <p className="max-w-[85%] text-lg break-words whitespace-pre-wrap">{event.text}</p>
    case 'thinking':
      return (
        <p className="flex gap-2 text-sm text-muted-foreground italic">
          <Brain className="mt-0.5 size-4 shrink-0" aria-hidden />
          {/* Claude's thoughts can run long, and matter less than what it goes on to do, so they are cut short. */}
          <span className="line-clamp-3 whitespace-pre-wrap">{event.text || 'Thinking…'}</span>
        </p>
      )
    case 'activity':
      return (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="break-words">{event.text}</span>
        </p>
      )
    case 'failure':
      return (
        <div className="flex gap-2 text-sm text-destructive" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {/* A failed build explains itself with many lines of output, which scroll rather than fill the page. */}
          <p className="max-h-48 min-w-0 flex-1 overflow-auto break-words whitespace-pre-wrap">{event.text}</p>
        </div>
      )
  }
}
