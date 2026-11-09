import { format } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'

import { greet } from '@/time/greet'
import { useNow } from '@/time/useNow'

/** The time, today's date and a greeting. The time's digits roll over as they change. */
export function ClockCard() {
  // A clock showing minutes needs to change within a second of the minute changing.
  const now = useNow(1000)

  return (
    <section className="glass rounded-4xl px-7 py-6 shadow-lg shadow-primary/15" aria-label="Clock">
      <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">{greet(now)}</p>
      <p className="mt-1 flex items-baseline font-heading text-8xl leading-none font-semibold tracking-tight tabular-nums sm:text-9xl">
        <RollingText text={format(now, 'HH')} />
        <motion.span
          className="px-1 text-primary-text"
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          :
        </motion.span>
        <RollingText text={format(now, 'mm')} />
      </p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{format(now, 'EEEE d MMMM')}</h1>
    </section>
  )
}

/** Shows text whose characters roll upwards, one by one, whenever they change. */
function RollingText({ text }: { text: string }) {
  return (
    <span className="inline-flex" aria-label={text}>
      {[...text].map((character, position) => (
        // Each position keeps its own slot, so that only the characters that changed roll.
        <span key={position} className="relative inline-block overflow-hidden" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={character}
              className="inline-block"
              initial={{ y: '-90%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '90%', opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
            >
              {character}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
