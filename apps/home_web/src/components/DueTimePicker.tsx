import { addDays, format, isBefore, nextMonday, nextSaturday, set } from 'date-fns'
import { CalendarHeart, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Choosing a day before a time needs some time to start from; the morning is the likeliest choice.
const DEFAULT_HOURS = 9

interface DueTimePickerProps {
  /** The chosen due time, or null for none. */
  value: Date | null
  /** Called with the new due time, or null when it is cleared. */
  onChange: (dueAt: Date | null) => void
}

/** A button that opens a calendar, quick choices and a time field for choosing an optional due time. */
export function DueTimePicker({ value, onChange }: DueTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  // Presets are relative to the time the picker opens, so that "this evening" means this evening when it is chosen.
  const [presets, setPresets] = useState<Preset[]>([])

  const changeIsOpen = (isNowOpen: boolean) => {
    if (isNowOpen) setPresets(createPresets(new Date()))
    setIsOpen(isNowOpen)
  }

  const chooseDay = (day: Date | undefined) => {
    if (!day) return
    const time = value ?? set(day, { hours: DEFAULT_HOURS, minutes: 0 })
    onChange(set(day, { hours: time.getHours(), minutes: time.getMinutes(), seconds: 0, milliseconds: 0 }))
  }

  const chooseTime = (timeText: string) => {
    // A time field that has been emptied sends an empty string, which leaves the due time as it was.
    const [hours, minutes] = timeText.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return
    onChange(set(value ?? new Date(), { hours, minutes, seconds: 0, milliseconds: 0 }))
  }

  const choosePreset = (dueAt: Date) => {
    onChange(dueAt)
    setIsOpen(false)
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={changeIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-input bg-field px-4 text-sm font-semibold text-foreground hover:bg-accent"
          >
            <CalendarHeart className="text-primary-text" />
            {value ? format(value, 'EEE d MMM, HH:mm') : 'Add a due time'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-3xl border-border p-3 shadow-xl shadow-shade">
          <div className="flex flex-wrap gap-1.5 pb-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => choosePreset(preset.dueAt)}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground transition hover:-translate-y-0.5 hover:bg-lavender active:translate-y-0"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={chooseDay}
            defaultMonth={value ?? undefined}
            weekStartsOn={1}
          />
          <label className="flex items-center justify-between gap-3 border-t border-border px-1 pt-3 text-sm font-semibold">
            Time
            <Input
              type="time"
              value={value ? format(value, 'HH:mm') : ''}
              onChange={(event) => chooseTime(event.target.value)}
              className="h-9 w-32 rounded-full bg-field text-center"
            />
          </label>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:bg-accent"
          onClick={() => onChange(null)}
          aria-label="Remove the due time"
        >
          <X />
        </Button>
      )}
    </div>
  )
}

interface Preset {
  label: string
  dueAt: Date
}

function createPresets(now: Date): Preset[] {
  const atTime = (day: Date, hours: number) => set(day, { hours, minutes: 0, seconds: 0, milliseconds: 0 })
  const thisEvening = atTime(now, 18)
  return [
    // Offering "this evening" once the evening has started would choose a time in the past.
    ...(isBefore(now, thisEvening) ? [{ label: 'This evening', dueAt: thisEvening }] : []),
    { label: 'Tomorrow morning', dueAt: atTime(addDays(now, 1), DEFAULT_HOURS) },
    { label: 'Weekend', dueAt: atTime(nextSaturday(now), 10) },
    { label: 'Next week', dueAt: atTime(nextMonday(now), DEFAULT_HOURS) },
  ]
}
