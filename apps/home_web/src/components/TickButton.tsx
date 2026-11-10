import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { playCompletionChime } from '@/sound/playCompletionChime'

// Ticking off moves the reminder down to "Done", so the change waits until the celebration has mostly played.
const CELEBRATION_MILLISECONDS = 650

const SPARKLE_COLOURS = ['var(--primary)', 'var(--lavender)', 'var(--mint)', 'var(--butter)', 'var(--sky)', 'var(--peach)']
const SPARKLE_COUNT = 10

interface TickButtonProps {
  isCompleted: boolean
  /** Called to change whether the reminder is completed. When ticking off, it is called after a short celebration. */
  onToggle: () => void
  /** The reminder's title, so that screen readers can say what the button ticks off. */
  reminderTitle: string
}

/** A checkbox that celebrates ticking a reminder off with a chime and a burst of sparkles. */
export function TickButton({ isCompleted, onToggle, reminderTitle }: TickButtonProps) {
  const [isCelebrating, setIsCelebrating] = useState(false)
  const celebrationTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isTicked = isCompleted || isCelebrating

  useEffect(() => () => clearTimeout(celebrationTimeout.current), [])

  const toggle = () => {
    if (isCelebrating) return
    if (isCompleted) {
      onToggle()
      return
    }

    setIsCelebrating(true)
    playCompletionChime()
    celebrationTimeout.current = setTimeout(() => {
      setIsCelebrating(false)
      onToggle()
    }, CELEBRATION_MILLISECONDS)
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.85 }}
      aria-pressed={isTicked}
      aria-label={isCompleted ? `Untick ${reminderTitle}` : `Tick off ${reminderTitle}`}
      className="relative grid size-11 shrink-0 place-items-center rounded-full"
    >
      <motion.span
        className="absolute inset-0 rounded-full border-[2.5px]"
        animate={{
          backgroundColor: isTicked ? 'var(--mint)' : 'var(--field)',
          borderColor: isTicked ? 'oklch(0.75 0.09 165)' : 'var(--primary)',
          scale: isCelebrating ? [1, 1.25, 1] : 1,
        }}
        transition={{ duration: 0.35 }}
      />
      <svg viewBox="0 0 24 24" className="relative size-6" aria-hidden>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="oklch(0.42 0.09 165)"
          strokeWidth={3}
          strokeLinecap="square"
          strokeLinejoin="miter"
          initial={false}
          animate={{ pathLength: isTicked ? 1 : 0, opacity: isTicked ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </svg>
      <AnimatePresence>{isCelebrating && <SparkleBurst />}</AnimatePresence>
    </motion.button>
  )
}

function SparkleBurst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: SPARKLE_COUNT }, (_, index) => {
        const angle = (index / SPARKLE_COUNT) * 2 * Math.PI
        const distance = 30 + (index % 3) * 6
        return (
          <motion.span
            key={index}
            className="absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 rounded-full"
            style={{ backgroundColor: SPARKLE_COLOURS[index % SPARKLE_COLOURS.length] }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, scale: [0, 1.4, 0.6], opacity: [1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )
      })}
    </span>
  )
}
