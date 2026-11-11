import { Clock, Pencil, Repeat as RepeatIcon, Trash2, User } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { EditReminderDialog } from '@/components/EditReminderDialog'
import { TickButton } from '@/components/TickButton'
import { Button } from '@/components/ui/button'
import { describeReminder, type Countdown, type Urgency } from '@/reminders/describeReminder'
import { REPEAT_DESCRIPTIONS } from '@/reminders/describeRepeat'
import type { Reminder } from '@/reminders/reminder'
import { useReminderActions } from '@/reminders/useReminders'
import { cn } from 'cn'

/** The colours of the countdown bubble, which say at a glance how pressing a reminder is. */
const COUNTDOWN_CLASS_NAMES: Record<Urgency, string> = {
  overdue: 'bg-peach text-[oklch(0.42_0.1_40)]',
  dueToday: 'bg-butter text-[oklch(0.42_0.08_80)]',
  upcoming: 'bg-sky text-[oklch(0.4_0.07_240)]',
  unscheduled: '',
  completed: '',
}

interface ReminderCardProps {
  reminder: Reminder
  /** The current time, which decides how pressing the reminder is. */
  now: Date
  /** Whether to offer deleting the reminder. */
  canDelete: boolean
  /** Whether the notes and due time are showing before the reminder is first tapped. */
  areDetailsShownAtFirst: boolean
}

/**
 * Shows a reminder, with controls to tick it off, edit it and, optionally, delete it. Tapping it shows or hides its
 * notes, due time and how often it repeats. Who it is for always shows, so that it can be seen at a glance.
 */
export function ReminderCard({ reminder, now, canDelete, areDetailsShownAtFirst }: ReminderCardProps) {
  const { saveReminder, deleteReminder } = useReminderActions()
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  // Hiding the notes and the due time leaves room for a title that can be read from across the room. The countdown
  // still says how pressing the reminder is.
  const [isShowingDetails, setIsShowingDetails] = useState(areDetailsShownAtFirst)

  const { urgency, dueLabel, countdown } = describeReminder(reminder, now)
  const isCompleted = urgency === 'completed'
  const hasDetails = Boolean(reminder.notes || dueLabel)

  // A failed change is undone on screen, and the header shows that the reminders can't be reached, so the outcome
  // needs no further handling here.
  const toggleCompleted = () => void saveReminder({ ...reminder, completedAt: isCompleted ? null : new Date() })

  return (
    <article
      className={cn(
        'group flex items-center gap-4 panel rounded-3xl p-4 shadow-md shadow-shade transition-[box-shadow,opacity] hover:shadow-lg hover:shadow-shade',
        urgency === 'overdue' && 'ring-2 ring-peach',
        isCompleted && 'opacity-70',
      )}
    >
      <TickButton isCompleted={isCompleted} onToggle={toggleCompleted} reminderTitle={reminder.title} />

      <button
        type="button"
        onClick={() => setIsShowingDetails(!isShowingDetails)}
        aria-expanded={isShowingDetails}
        disabled={!hasDetails}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={cn(
            'text-xl leading-snug font-bold break-words transition-colors sm:text-2xl',
            isCompleted && 'text-muted-foreground line-through decoration-primary decoration-2',
          )}
        >
          {reminder.title}
        </p>
        {reminder.assignedTo && (
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-primary-text">
            <User className="size-4 shrink-0" />
            {reminder.assignedTo}
          </p>
        )}
        {isShowingDetails && reminder.notes && <p className="mt-1 break-words text-muted-foreground">{reminder.notes}</p>}
        {/* The card leaves little width for text on a phone, so the due time can only wrap between its date and its time.
            How pressing it is needs no words here, as the countdown already shows it. */}
        {isShowingDetails && dueLabel && (
          <p className="mt-1.5 flex items-start gap-1.5 font-semibold text-muted-foreground">
            <Clock className="mt-[0.2em] size-4 shrink-0" />
            <span>
              <span className="whitespace-nowrap">{dueLabel.date},</span> <span className="whitespace-nowrap">{dueLabel.time}</span>
            </span>
          </p>
        )}
        {isShowingDetails && reminder.repeats && (
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-muted-foreground">
            <RepeatIcon className="size-4 shrink-0" />
            {REPEAT_DESCRIPTIONS[reminder.repeats]}
          </p>
        )}
      </button>

      {countdown && !isCompleted && <CountdownBubble countdown={countdown} className={COUNTDOWN_CLASS_NAMES[urgency]} isPulsing={urgency === 'overdue'} />}

      <div className="flex flex-col gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary" onClick={() => setIsEditing(true)} aria-label={`Edit ${reminder.title}`}>
          <Pencil />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setIsConfirmingDelete(true)}
            aria-label={`Delete ${reminder.title}`}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <EditReminderDialog reminder={reminder} isOpen={isEditing} onOpenChange={setIsEditing} />
      {canDelete && (
        <ConfirmDeleteDialog
          question="Delete this reminder?"
          itemName={reminder.title}
          isOpen={isConfirmingDelete}
          onOpenChange={setIsConfirmingDelete}
          onConfirm={() => void deleteReminder(reminder.id)}
        />
      )}
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
      <span className="font-heading text-xl leading-none font-semibold sm:text-2xl">{countdown.value}</span>
      <span className="mt-1 text-[0.7rem] leading-none font-bold tracking-wide uppercase">{countdown.caption}</span>
    </motion.div>
  )
}
