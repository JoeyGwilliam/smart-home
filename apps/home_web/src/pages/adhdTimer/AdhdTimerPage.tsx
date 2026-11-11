import { format } from 'date-fns'
import { CloudOff, Play, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { TimerDial } from '@/pages/adhdTimer/TimerDial'
import { TimerPlanEditor } from '@/pages/adhdTimer/TimerPlanEditor'
import { TimerPresets } from '@/pages/adhdTimer/TimerPresets'
import { useSpokenAnnouncement } from '@/sound/useSpokenAnnouncement'
import { useNow } from '@/time/useNow'
import { describeAnnouncement, describeTimerProgress, formatCountdown, type TimerProgress } from '@/timers/describeTimerProgress'
import { findNextEndTime, scheduleTimer, type TimerSchedule } from '@/timers/scheduleTimer'
import type { ActiveTimer, TimerPlan } from '@/timers/timer'
import { useActiveTimer } from '@/timers/useActiveTimer'

/**
 * A timer for getting ready on time. A plan of tasks is stacked back from the time to be ready by, and drawn as a ring
 * that shows when each has to start. Once started, a hand follows the time around the ring and each task is announced
 * aloud as it begins. Plans can be saved as presets and loaded again.
 *
 * Every screen shows the same timer, so it can be set up and started on one and followed on another.
 */
export function AdhdTimerPage() {
  const now = useNow()
  const { timer, isUnavailable, changePlan, start, stop } = useActiveTimer()

  return (
    // The dial is what gets read from across the room, so it takes the wider column.
    <main className="mx-auto grid w-full max-w-6xl items-start gap-6 px-4 pb-10 sm:pb-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <header className="lg:col-span-2">
        <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">{format(now, 'EEEE d MMMM')}</p>
        <h1 className="mt-1 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">ADHD timer</h1>
        <div className="mt-3 flex min-h-7 items-center">
          {/* Only shown beside a timer, since the message below explains the problem when there is none. */}
          <AnimatePresence>
            {isUnavailable && timer && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <Pill className="bg-field text-muted-foreground">
                  <CloudOff className="size-3.5" />
                  Reconnecting…
                </Pill>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* The timer only appears once it has been fetched, so that what it loads with is never mistaken for a change
          that needs announcing. */}
      {timer && <Timer timer={timer} onChangePlan={changePlan} onStart={start} onStop={stop} />}
      {!timer && isUnavailable && (
        <section className="panel rounded-4xl px-5 py-8 text-center shadow-lg shadow-shade lg:col-span-2">
          <h2 className="text-2xl font-semibold">Can't reach the timer</h2>
          <p className="mt-1 text-muted-foreground">It will appear here as soon as it can be reached again.</p>
        </section>
      )}
    </main>
  )
}

interface TimerProps {
  timer: ActiveTimer
  onChangePlan: (plan: TimerPlan) => void
  onStart: () => void
  onStop: () => void
}

/** The dial and its controls, beside the editor for the plan and the presets. */
function Timer({ timer, onChangePlan, onStart, onStop }: TimerProps) {
  // The countdown shows seconds, so the timer keeps time to the second.
  const now = useNow(1000)
  const { plan, startedAt } = timer
  const isStarted = startedAt !== null

  // A stopped timer previews the next time the clock shows the end time. Starting it settles which day that is, so
  // that the timer stays finished once the end time has passed, rather than moving on to tomorrow.
  const schedule = scheduleTimer(plan, findNextEndTime(plan.endTime, startedAt ?? now))
  const progress = describeTimerProgress(schedule, now)

  // There is something new to say each time a different task begins, and when the timer starts and finishes.
  const announcementTopic = isStarted ? (progress.currentTask?.task.id ?? progress.stage) : null
  useSpokenAnnouncement(announcementTopic, () => describeAnnouncement(schedule, now))

  return (
    <>
      <motion.section
        className="panel grid gap-4 rounded-4xl px-3 py-5 shadow-lg shadow-shade sm:px-7 sm:py-6 lg:sticky lg:top-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        aria-label="Timer"
      >
        <TimerDial schedule={schedule} elapsedFraction={isStarted ? progress.elapsedFraction : null}>
          <TimerReadout schedule={schedule} progress={progress} isStarted={isStarted} now={now} />
        </TimerDial>

        <div className="flex min-h-11 flex-wrap items-center justify-center gap-3">
          {isStarted && progress.currentTask && (
            <Pill className="bg-secondary text-base text-secondary-foreground">Now: {progress.currentTask.task.name.trim() || 'the next task'}</Pill>
          )}
          {isStarted ? (
            <Button variant="secondary" onClick={onStop} className="h-11 rounded-full px-6 text-base font-bold">
              <Square />
              Stop
            </Button>
          ) : (
            <Button onClick={onStart} className="h-11 rounded-full px-6 text-base font-bold shadow-md shadow-shade">
              <Play />
              Start
            </Button>
          )}
        </div>
      </motion.section>

      <motion.div className="grid gap-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        <TimerPlanEditor plan={plan} schedule={schedule} currentTaskId={isStarted ? (progress.currentTask?.task.id ?? null) : null} onChange={onChangePlan} />
        <TimerPresets plan={plan} onChange={onChangePlan} />
      </motion.div>
    </>
  )
}

interface TimerReadoutProps {
  schedule: TimerSchedule
  progress: TimerProgress
  isStarted: boolean
  now: Date
}

/** The middle of the dial: the time to be ready by, and what is coming next and how soon. */
function TimerReadout({ schedule, progress, isStarted, now }: TimerReadoutProps) {
  const upNext = describeUpNext(schedule, progress, isStarted, now)

  return (
    <>
      <p className="text-[0.65rem] leading-none font-extrabold tracking-[0.18em] text-muted-foreground uppercase sm:text-xs">Ready by</p>
      <p className="mt-1 font-heading text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl">{format(schedule.endsAt, 'HH:mm')}</p>
      {upNext && (
        <div className="mt-2.5 border-t-2 border-border pt-2.5" aria-live="off">
          <p className="truncate text-[0.65rem] leading-none font-extrabold tracking-[0.18em] text-primary-text uppercase sm:text-xs">{upNext.caption}</p>
          <p className="mt-1 font-heading text-2xl leading-none font-semibold tabular-nums sm:text-3xl">{upNext.value}</p>
        </div>
      )}
    </>
  )
}

/** What the lower half of the readout says, or null when there is nothing to add to the end time. */
function describeUpNext(schedule: TimerSchedule, progress: TimerProgress, isStarted: boolean, now: Date): { caption: string; value: string } | null {
  if (!isStarted) {
    return schedule.tasks.length > 0 ? { caption: 'Start by', value: format(schedule.startsAt, 'HH:mm') } : null
  }
  if (progress.stage === 'finished') return { caption: "Time's up", value: formatCountdown(0) }

  const { nextTask } = progress
  if (nextTask) {
    const taskName = nextTask.task.name.trim() || 'Next task'
    return { caption: `${taskName} in`, value: formatCountdown(nextTask.startsAt.getTime() - now.getTime()) }
  }
  return { caption: 'Time left', value: formatCountdown(schedule.endsAt.getTime() - now.getTime()) }
}
