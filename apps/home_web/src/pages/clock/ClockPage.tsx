import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'

import { useNow } from '@/time/useNow'

/**
 * Nothing but the current time and today's date, large enough to read from across the room. Clicking anywhere on the
 * page goes to the dashboard.
 */
export function ClockPage() {
  // Only minutes are shown, but updating every second keeps the time within a second of the minute changing.
  const now = useNow(1000)

  return (
    <main>
      {/* The link fills the screen beneath the menus (whose 4.25rem RootLayout clears), so the clock sits in the middle
          and a click anywhere reaches the dashboard. */}
      <Link
        to="/"
        aria-label="Go to the dashboard"
        className="grid w-full min-h-[calc(100dvh-4.25rem)] place-items-center px-4 pb-10 text-center sm:pb-14"
      >
        <div className="mx-auto max-w-4xl">
          <p className="font-heading text-7xl leading-none font-semibold tracking-tight tabular-nums sm:text-[10rem]">
            {format(now, 'HH:mm')}
          </p>
          <h1 className="mt-4 text-2xl font-semibold sm:text-5xl">{format(now, 'EEEE d MMMM yyyy')}</h1>
        </div>
      </Link>
    </main>
  )
}
