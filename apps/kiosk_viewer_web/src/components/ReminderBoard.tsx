import { format } from 'date-fns'
import { CloudOff, Flower2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode, Ref } from 'react'

import { AddReminderCard } from '@/components/AddReminderCard'
import { ReminderCard } from '@/components/ReminderCard'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/useNow'
import { describeReminder } from '@/reminders/describeReminder'
import { organiseReminders } from '@/reminders/organiseReminders'
import type { Reminder } from '@/reminders/reminder'
import { useReminders } from '@/reminders/useReminders'

/** The whole kiosk screen: today's date, a form for adding reminders, and every reminder. */
export function ReminderBoard() {
  const now = useNow()
  const remindersQuery = useReminders()
  const reminders = remindersQuery.data

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-10 sm:py-14">
      <Header now={now} reminders={reminders} isOffline={remindersQuery.isError} />
      <AddReminderCard />
      {reminders ? (
        <ReminderList reminders={reminders} now={now} />
      ) : remindersQuery.isError ? (
        <UnavailableNotice onRetry={() => void remindersQuery.refetch()} />
      ) : (
        <LoadingCards />
      )}
    </main>
  )
}

interface HeaderProps {
  now: Date
  /** Every reminder, or undefined before they have loaded. */
  reminders: Reminder[] | undefined
  /** Whether the latest attempt to fetch the reminders failed. */
  isOffline: boolean
}

function Header({ now, reminders, isOffline }: HeaderProps) {
  const urgencies = (reminders ?? []).map((reminder) => describeReminder(reminder, now).urgency)
  const toDoCount = urgencies.filter((urgency) => urgency !== 'completed').length
  const overdueCount = urgencies.filter((urgency) => urgency === 'overdue').length

  return (
    <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">{greet(now)}</p>
      <h1 className="mt-1 text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">{format(now, 'EEEE d MMMM')}</h1>
      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2">
        {reminders && (
          <>
            <Pill className="bg-secondary text-secondary-foreground">{toDoCount === 0 ? 'All done' : `${toDoCount} to do`}</Pill>
            {overdueCount > 0 && <Pill className="bg-peach text-[oklch(0.42_0.1_40)]">{overdueCount} overdue</Pill>}
          </>
        )}
        <AnimatePresence>
          {isOffline && reminders && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <Pill className="bg-field text-muted-foreground">
                <CloudOff className="size-3.5" />
                Reconnecting…
              </Pill>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  )
}

function greet(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${className}`}>{children}</span>
}

interface ReminderListProps {
  reminders: Reminder[]
  now: Date
}

function ReminderList({ reminders, now }: ReminderListProps) {
  const { active, completed } = organiseReminders(reminders)

  // Everything is a sibling in one animated list, including the "Done" heading, so that a reminder that is ticked off
  // glides from its place among the active reminders to its place under the heading.
  return (
    <div className="grid gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {active.length === 0 && (
          <AnimatedItem key="empty">
            <EmptyState />
          </AnimatedItem>
        )}
        {active.map((reminder) => (
          <AnimatedItem key={reminder.id}>
            <ReminderCard reminder={reminder} now={now} />
          </AnimatedItem>
        ))}
        {completed.length > 0 && (
          <AnimatedItem key="done-heading">
            <h2 className="mt-6 mb-1 px-2 text-2xl font-semibold text-muted-foreground">Done</h2>
          </AnimatedItem>
        )}
        {completed.map((reminder) => (
          <AnimatedItem key={reminder.id}>
            <ReminderCard reminder={reminder} now={now} />
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

function EmptyState() {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-primary/50 bg-field/50 px-6 py-12 text-center">
      <motion.span
        className="grid size-16 place-items-center rounded-full bg-primary/60 text-primary-foreground"
        animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Flower2 className="size-8" />
      </motion.span>
      <p className="font-heading text-2xl font-semibold">Nothing to do</p>
      <p className="text-muted-foreground">Enjoy it.</p>
    </div>
  )
}

function UnavailableNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid place-items-center gap-3 rounded-3xl border border-glass-edge bg-card px-6 py-12 text-center shadow-md shadow-primary/10 backdrop-blur-xl"
    >
      <motion.span
        className="grid size-16 place-items-center rounded-full bg-lavender text-secondary-foreground"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <CloudOff className="size-8" />
      </motion.span>
      <h2 className="text-2xl font-semibold">Can't reach your reminders</h2>
      <p className="max-w-sm text-muted-foreground">The reminders service isn't responding. Your reminders are safe, so try again in a moment.</p>
      <Button onClick={onRetry} className="mt-2 h-10 rounded-full px-6 font-bold shadow-md shadow-primary/30">
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
