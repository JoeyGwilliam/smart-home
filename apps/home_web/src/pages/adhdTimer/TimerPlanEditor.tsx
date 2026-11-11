import { format } from 'date-fns'
import { GripVertical, X } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pickTaskColour } from '@/pages/adhdTimer/taskColours'
import type { ScheduledTask, TimerSchedule } from '@/timers/scheduleTimer'
import { createTask, type TimerPlan, type TimerTask } from '@/timers/timer'
import { cn } from 'cn'

// Faffing beyond three times as long is better fixed by giving the tasks more minutes.
const LARGEST_FAFF_MULTIPLIER = 3

// A new task most often takes about this long, so the field starts here.
const DEFAULT_TASK_MINUTES = 10

interface TimerPlanEditorProps {
  plan: TimerPlan
  /** The plan's schedule, which gives each task the start time shown beside it. */
  schedule: TimerSchedule
  /** The id of the task to highlight as happening now, or null for none. */
  currentTaskId: string | null
  onChange: (plan: TimerPlan) => void
}

/**
 * The controls for everything in a plan except its name: the time to be ready by, the faff multiplier, and the tasks,
 * which can be added, edited, removed and dragged into a different order.
 */
export function TimerPlanEditor({ plan, schedule, currentTaskId, onChange }: TimerPlanEditorProps) {
  const changeTasks = (tasks: TimerTask[]) => onChange({ ...plan, tasks })

  const changeTask = (changedTask: TimerTask) => changeTasks(plan.tasks.map((task) => (task.id === changedTask.id ? changedTask : task)))

  // Does nothing when the task is already at that end of the plan.
  const moveTask = (position: number, direction: -1 | 1) => {
    const newPosition = position + direction
    if (newPosition < 0 || newPosition >= plan.tasks.length) return
    const tasks = [...plan.tasks]
    ;[tasks[position], tasks[newPosition]] = [tasks[newPosition], tasks[position]]
    changeTasks(tasks)
  }

  const changeEndTime = (endTime: string) => {
    // A time field that has been emptied sends an empty string, which leaves the end time as it was.
    if (endTime) onChange({ ...plan, endTime })
  }

  return (
    <section className="panel grid gap-5 rounded-4xl px-5 py-5 shadow-lg shadow-shade sm:px-7 sm:py-6" aria-label="Plan">
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
        <label className="grid gap-1.5 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
          Ready by
          <Input
            type="time"
            value={plan.endTime}
            onChange={(event) => changeEndTime(event.target.value)}
            className="h-11 w-36 rounded-full bg-field text-center font-heading text-xl! font-semibold text-foreground"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
          <span className="flex items-baseline justify-between gap-3">
            Faff multiplier
            <span className="font-heading text-xl leading-none font-semibold text-primary-text normal-case tabular-nums">×{plan.faffMultiplier.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min={1}
            max={LARGEST_FAFF_MULTIPLIER}
            step={0.1}
            value={plan.faffMultiplier}
            onChange={(event) => onChange({ ...plan, faffMultiplier: Number(event.target.value) })}
            className="soft-slider h-11 w-full"
          />
        </label>
      </div>

      {plan.tasks.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border px-4 py-6 text-center text-muted-foreground">
          <span className="block font-heading text-xl font-semibold text-foreground">Nothing to do yet</span>
          Add what needs doing before {plan.endTime}, in the order it happens.
        </p>
      ) : (
        <Reorder.Group as="ol" axis="y" values={plan.tasks} onReorder={changeTasks} className="grid gap-2" aria-label="Tasks">
          {schedule.tasks.map((scheduledTask, position) => (
            <TaskRow
              key={scheduledTask.task.id}
              scheduledTask={scheduledTask}
              position={position}
              isCurrent={scheduledTask.task.id === currentTaskId}
              onChange={changeTask}
              onMove={(direction) => moveTask(position, direction)}
              onRemove={() => changeTasks(plan.tasks.filter((task) => task.id !== scheduledTask.task.id))}
            />
          ))}
        </Reorder.Group>
      )}

      <AddTaskForm onAdd={(task) => changeTasks([...plan.tasks, task])} />

      {plan.tasks.length > 0 && (
        <p className="text-center font-semibold text-muted-foreground">
          {formatMinutes(countMinutesBetween(schedule.startsAt, schedule.endsAt))} in all, starting at{' '}
          <span className="font-bold text-foreground">{format(schedule.startsAt, 'HH:mm')}</span>
        </p>
      )}
    </section>
  )
}

interface TaskRowProps {
  scheduledTask: ScheduledTask
  /** The task's position in the plan, counting from 0. */
  position: number
  /** Whether to highlight the task as happening now. */
  isCurrent: boolean
  onChange: (task: TimerTask) => void
  /** Called to swap the task with the one before it (-1) or after it (1). */
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

function TaskRow({ scheduledTask, position, isCurrent, onChange, onMove, onRemove }: TaskRowProps) {
  const { task, startsAt, endsAt } = scheduledTask
  // Dragging only starts from the grip, so that the fields in the row can still be tapped and typed in.
  const dragControls = useDragControls()
  const spokenName = task.name.trim() || `task ${position + 1}`
  const paddedMinutes = countMinutesBetween(startsAt, endsAt)

  const moveWithArrowKeys = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    onMove(event.key === 'ArrowUp' ? -1 : 1)
  }

  return (
    <Reorder.Item
      as="li"
      value={task}
      dragListener={false}
      dragControls={dragControls}
      aria-current={isCurrent ? 'step' : undefined}
      className={cn('flex items-center gap-1.5 rounded-3xl border-2 border-border bg-field py-2 pr-1.5 pl-1', isCurrent && 'border-primary shadow-md shadow-shade')}
    >
      <button
        type="button"
        onPointerDown={(event) => dragControls.start(event)}
        onKeyDown={moveWithArrowKeys}
        aria-label={`Move ${spokenName}. Drag, or use the up and down arrow keys.`}
        // Without touch-none, a touchscreen would scroll the page instead of dragging the task.
        className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-full text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-5" />
      </button>

      <div className="grid min-w-0 flex-1 gap-1.5">
        <input
          value={task.name}
          onChange={(event) => onChange({ ...task, name: event.target.value })}
          placeholder="Name this task"
          aria-label={`Task ${position + 1} name`}
          className="min-w-0 bg-transparent text-lg leading-tight font-bold placeholder:font-semibold placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-muted-foreground">
          <span
            className="rounded-full px-2.5 py-0.5 font-bold text-[oklch(0.3_0.05_15)] tabular-nums"
            style={{ backgroundColor: pickTaskColour(position) }}
          >
            {format(startsAt, 'HH:mm')}
          </span>
          <span className="flex items-center gap-1.5">
            <MinutesField minutes={task.minutes} onChange={(minutes) => onChange({ ...task, minutes })} label={`Task ${position + 1} minutes`} />
            min
          </span>
          {paddedMinutes !== task.minutes && <span>→ {formatMinutes(paddedMinutes)} with faff</span>}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
        aria-label={`Remove ${spokenName}`}
      >
        <X />
      </Button>
    </Reorder.Item>
  )
}

function AddTaskForm({ onAdd }: { onAdd: (task: TimerTask) => void }) {
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState(DEFAULT_TASK_MINUTES)
  const hasName = name.trim() !== ''

  const addTask = (event: FormEvent) => {
    event.preventDefault()
    if (!hasName) return
    onAdd(createTask(name.trim(), minutes))
    // The minutes are kept, as a run of similar tasks is often added together.
    setName('')
  }

  return (
    <form onSubmit={addTask} className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-dashed border-border py-1.5 pr-2 pl-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Add a task…"
        aria-label="New task name"
        className="min-w-24 flex-1 bg-transparent text-lg font-semibold placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <MinutesField minutes={minutes} onChange={setMinutes} label="New task minutes" />
        min
      </span>
      <Button type="submit" disabled={!hasName} className="h-9 rounded-full px-4 text-base font-bold">
        Add
      </Button>
    </form>
  )
}

interface MinutesFieldProps {
  minutes: number
  /** Called with a whole number of minutes, at least 1, each time the field holds one. */
  onChange: (minutes: number) => void
  /** Names the field for screen readers. */
  label: string
}

/**
 * A field for a whole number of minutes. While it holds anything else, such as nothing at all halfway through being
 * retyped, the minutes stay as they were, and it goes back to showing them when it is left.
 */
function MinutesField({ minutes, onChange, label }: MinutesFieldProps) {
  const [text, setText] = useState(String(minutes))

  // The minutes can also change from outside the field, such as on another screen, and the field then has to show
  // them. Comparing with the minutes it last saw tells that apart from the field's own half-typed text.
  const [lastSeenMinutes, setLastSeenMinutes] = useState(minutes)
  if (minutes !== lastSeenMinutes) {
    setLastSeenMinutes(minutes)
    if (Number(text) !== minutes) setText(String(minutes))
  }

  const changeText = (newText: string) => {
    setText(newText)
    const newMinutes = Number(newText)
    if (Number.isInteger(newMinutes) && newMinutes >= 1) onChange(newMinutes)
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      value={text}
      onChange={(event) => changeText(event.target.value)}
      onBlur={() => setText(String(minutes))}
      aria-label={label}
      className="h-8 w-16 rounded-full bg-card px-1 text-center text-base! font-bold text-foreground"
    />
  )
}

function countMinutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}
