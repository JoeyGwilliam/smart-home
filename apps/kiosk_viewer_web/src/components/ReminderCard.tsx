import { Clock, Pencil, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { DeleteReminderDialog } from '@/components/DeleteReminderDialog'
import { EditReminderDialog } from '@/components/EditReminderDialog'
import { TickButton } from '@/components/TickButton'
import { Button } from '@/components/ui/button'
import { describeReminder, type Countdown, type Urgency } from '@/reminders/describeReminder'
import type { Reminder } from '@/reminders/reminder'
import { useReminderActions } from '@/reminders/useReminders'
import { cn } from 'cn'

interface UrgencyStyle {
  /** Words in front of the due time, such as "Overdue". */
  prefix: string | null
  /** Classes for the countdown bubble. */
  countdownClassName: string
}

const URGENCY_STYLES: Record<Urgency, UrgencyStyle> = {
  overdue: { prefix: 'Overdue', countdownClassName: 'bg-peach text-[oklch(0.42_0.1_40)]' },
  dueToday: { prefix: 'Due today', countdownClassName: 'bg-butter text-[oklch(0.42_0.08_80)]' },
  upcoming: { prefix: null, countdownClassName: 'bg-sky text-[oklch(0.4_0.07_240)]' },
  unscheduled: { prefix: null, countdownClassName: '' },
  completed: { prefix: null, countdownClassName: '' },
}

interface ReminderCardProps {
  reminder: Reminder
  /** The current time, which decides how pressing the reminder is. */
  now: Date
}

/** Shows a reminder, with controls to tick it off, edit it and delete it. */
export function ReminderCard({ reminder, now }: ReminderCardProps) {
  const { saveReminder, deleteReminder } = useReminderActions()
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const { urgency, dueLabel, countdown } = describeReminder(reminder, now)
  const style = URGENCY_STYLES[urgency]
  const isCompleted = urgency === 'completed'

  // A failed change is undone on screen, and the header shows that the reminders can't be reached, so the outcome
  // needs no further handling here.
  const toggleCompleted = () => void saveReminder({ ...reminder, completedAt: isCompleted ? null : new Date() })

  return (
    <article
      className={cn(
        'group flex items-center gap-4 rounded-3xl border border-white/80 bg-card p-4 shadow-md shadow-primary/10 backdrop-blur-xl transition-[box-shadow,opacity] hover:shadow-lg hover:shadow-primary/20',
        urgency === 'overdue' && 'ring-2 ring-peach',
        isCompleted && 'opacity-70',
      )}
    >
      <TickButton isCompleted={isCompleted} onToggle={toggleCompleted} reminderTitle={reminder.title} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-lg leading-snug font-bold break-words transition-colors',
            isCompleted && 'text-muted-foreground line-through decoration-primary decoration-2',
          )}
        >
          {reminder.title}
        </p>
        {reminder.notes && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{reminder.notes}</p>}
        {dueLabel && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Clock className="size-3.5" />
            {style.prefix && <span className="text-foreground">{style.prefix} ·</span>}
            {dueLabel}
          </p>
        )}
      </div>

      {countdown && !isCompleted && <CountdownBubble countdown={countdown} className={style.countdownClassName} isPulsing={urgency === 'overdue'} />}

      <div className="flex flex-col gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary" onClick={() => setIsEditing(true)} aria-label={`Edit ${reminder.title}`}>
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setIsConfirmingDelete(true)}
          aria-label={`Delete ${reminder.title}`}
        >
          <Trash2 />
        </Button>
      </div>

      <EditReminderDialog reminder={reminder} isOpen={isEditing} onOpenChange={setIsEditing} />
      <DeleteReminderDialog
        reminderTitle={reminder.title}
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        onConfirm={() => void deleteReminder(reminder.id)}
      />
    </article>
  )
}

interface CountdownBubbleProps {
  countdown: Countdown
  className: string
  /** Whether to pulse gently, to draw the eye to something that needs doing now. */
  isPulsing: boolean
}

function CountdownBubble({ countdown, className, isPulsing }: CountdownBubbleProps) {
  return (
    <motion.div
      className={cn('grid min-w-18 shrink-0 place-items-center rounded-2xl px-3 py-2 text-center', className)}
      animate={isPulsing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={isPulsing ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <span className="font-heading text-2xl leading-none font-semibold">{countdown.value}</span>
      <span className="mt-1 text-[0.7rem] leading-none font-bold tracking-wide uppercase">{countdown.caption}</span>
    </motion.div>
  )
}
