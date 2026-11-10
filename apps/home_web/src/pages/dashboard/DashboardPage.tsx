import { motion } from 'motion/react'

import { ReminderList } from '@/components/ReminderList'
import { ClockCard } from '@/pages/dashboard/ClockCard'
import { WeatherCard } from '@/pages/dashboard/WeatherCard'
import { selectDueToday } from '@/reminders/selectDueToday'
import { useNow } from '@/time/useNow'

/** An at-a-glance screen: the time, the weather, and the reminders that matter today. */
export function DashboardPage() {
  const now = useNow()

  return (
    <main className="mx-auto grid w-full max-w-6xl items-start gap-6 px-4 pb-10 sm:pb-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <motion.div className="grid gap-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <ClockCard />
        <WeatherCard />
      </motion.div>
      <motion.section
        className="grid gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        aria-labelledby="due-today-heading"
      >
        <h2 id="due-today-heading" className="px-2 pt-2 text-2xl font-semibold sm:text-3xl">
          Due today
        </h2>
        <ReminderList
          now={now}
          select={selectDueToday}
          canDelete={false}
          emptyMessage={{ title: 'Nothing due today', detail: 'A free day. Lovely.' }}
        />
      </motion.section>
    </main>
  )
}
