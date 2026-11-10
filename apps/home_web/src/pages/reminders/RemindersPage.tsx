import { format } from 'date-fns'
import { CloudOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Pill } from '@/components/Pill'
import { ReminderList } from '@/components/ReminderList'
import { AddReminderCard } from '@/pages/reminders/AddReminderCard'
import { describeReminder } from '@/reminders/describeReminder'
import { useReminders } from '@/reminders/useReminders'
import { greet } from '@/time/greet'
import { useNow } from '@/time/useNow'

/** Every reminder, with today's date and a form for adding more. */
export function RemindersPage() {
  const now = useNow()

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 pb-10 sm:pb-14">
      <Header now={now} />
      <AddReminderCard />
      <ReminderList now={now} emptyMessage={{ title: 'Nothing to do', detail: 'Enjoy it.' }} areDetailsShownAtFirst />
    </main>
  )
}

function Header({ now }: { now: Date }) {
  const remindersQuery = useReminders()
  const reminders = remindersQuery.data
  const urgencies = (reminders ?? []).map((reminder) => describeReminder(reminder, now).urgency)
  const toDoCount = urgencies.filter((urgency) => urgency !== 'completed').length
  const overdueCount = urgencies.filter((urgency) => urgency === 'overdue').length

  return (
    <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">{greet(now)}</p>
      <h1 className="mt-1 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">{format(now, 'EEEE d MMMM')}</h1>
      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2">
        {reminders && (
          <>
            <Pill className="bg-secondary text-secondary-foreground">{toDoCount === 0 ? 'All done' : `${toDoCount} to do`}</Pill>
            {overdueCount > 0 && <Pill className="bg-peach text-[oklch(0.42_0.1_40)]">{overdueCount} overdue</Pill>}
          </>
        )}
        {/* Only shown once reminders have loaded, since ReminderList explains the problem when there are none. */}
        <AnimatePresence>
          {remindersQuery.isError && reminders && (
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
