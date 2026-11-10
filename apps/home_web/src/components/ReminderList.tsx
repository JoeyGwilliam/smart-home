import { CloudOff, Flower2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode, Ref } from 'react'

import { ReminderCard } from '@/components/ReminderCard'
import { Button } from '@/components/ui/button'
import { organiseReminders } from '@/reminders/organiseReminders'
import type { Reminder } from '@/reminders/reminder'
import { useReminders } from '@/reminders/useReminders'

/** What to say when there is nothing left to do. */
export interface EmptyMessage {
  title: string
  detail: string
}

interface ReminderListProps {
  /** The current time, which decides how pressing each reminder is. */
  now: Date
  /**
   * Picks which reminders to show, so that a page can show only some of them. Shows every reminder by default.
   *
   * @param reminders Every reminder, oldest first.
   * @param now The current time.
   * @returns The reminders to show, in any order.
   */
  select?: (reminders: Reminder[], now: Date) => Reminder[]
  /** Shown in place of the active reminders when none are left. */
  emptyMessage: EmptyMessage
  /** Whether reminders can be deleted from this list. Defaults to true. */
  canDelete?: boolean
  /**
   * Whether each reminder's notes and due time are showing before it is first tapped. Defaults to false, which suits
   * a screen read at a glance.
   */
  areDetailsShownAtFirst?: boolean
}

/**
 * Shows reminders that can be ticked off, edited and deleted: those still to do, soonest due first, then those that
 * are done. Fetches the reminders itself, and shows loading and unavailable states while it can't show them.
 */
export function ReminderList({
  now,
  select = (reminders) => reminders,
  emptyMessage,
  canDelete = true,
  areDetailsShownAtFirst = false,
}: ReminderListProps) {
  const remindersQuery = useReminders()

  if (remindersQuery.data) {
    return (
      <OrganisedReminderList
        reminders={select(remindersQuery.data, now)}
        now={now}
        emptyMessage={emptyMessage}
        canDelete={canDelete}
        areDetailsShownAtFirst={areDetailsShownAtFirst}
      />
    )
  }
  if (remindersQuery.isError) {
    return <UnavailableNotice onRetry={() => void remindersQuery.refetch()} />
  }
  return <LoadingCards />
}

interface OrganisedReminderListProps {
  reminders: Reminder[]
  now: Date
  emptyMessage: EmptyMessage
  canDelete: boolean
  areDetailsShownAtFirst: boolean
}

function OrganisedReminderList({ reminders, now, emptyMessage, canDelete, areDetailsShownAtFirst }: OrganisedReminderListProps) {
  const { active, completed } = organiseReminders(reminders)

  // Everything is a sibling in one animated list, including the "Done" heading, so that a reminder that is ticked off
  // glides from its place among the active reminders to its place under the heading.
  return (
    <div className="grid gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {active.length === 0 && (
          <AnimatedItem key="empty">
            <EmptyState message={emptyMessage} />
          </AnimatedItem>
        )}
        {active.map((reminder) => (
          <AnimatedItem key={reminder.id}>
            <ReminderCard reminder={reminder} now={now} canDelete={canDelete} areDetailsShownAtFirst={areDetailsShownAtFirst} />
          </AnimatedItem>
        ))}
        {completed.length > 0 && (
          <AnimatedItem key="done-heading">
            <h2 className="mt-6 mb-1 px-2 text-2xl font-semibold text-muted-foreground">Done</h2>
          </AnimatedItem>
        )}
        {completed.map((reminder) => (
          <AnimatedItem key={reminder.id}>
            <ReminderCard reminder={reminder} now={now} canDelete={canDelete} areDetailsShownAtFirst={areDetailsShownAtFirst} />
          </AnimatedItem>
        ))}
      </AnimatePresence>
    </div>
  )
}

function AnimatedItem({ children, ref }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', bounce: 0.25, duration: 0.55 }}
    >
      {children}
    </motion.div>
  )
}

function EmptyState({ message }: { message: EmptyMessage }) {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-primary/50 bg-field/50 px-6 py-12 text-center">
      <motion.span
        className="grid size-16 place-items-center rounded-full bg-primary/60 text-primary-foreground"
        animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Flower2 className="size-8" />
      </motion.span>
      <p className="font-heading text-2xl font-semibold">{message.title}</p>
      <p className="text-muted-foreground">{message.detail}</p>
    </div>
  )
}

function UnavailableNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel grid place-items-center gap-3 rounded-3xl px-6 py-12 text-center shadow-md shadow-shade">
      <motion.span
        className="grid size-16 place-items-center rounded-full bg-lavender text-secondary-foreground"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <CloudOff className="size-8" />
      </motion.span>
      <h2 className="text-2xl font-semibold">Can't reach your reminders</h2>
      <p className="max-w-sm text-muted-foreground">The reminders service isn't responding. Your reminders are safe, so try again in a moment.</p>
      <Button onClick={onRetry} className="mt-2 h-10 rounded-full px-6 font-bold shadow-md shadow-shade">
        Try again
      </Button>
    </motion.div>
  )
}

function LoadingCards() {
  return (
    <div className="grid gap-3" aria-label="Loading reminders">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="h-22 rounded-3xl bg-field"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.15 }}
        />
      ))}
    </div>
  )
}
