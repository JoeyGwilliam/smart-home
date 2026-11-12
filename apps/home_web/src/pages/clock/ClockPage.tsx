import { format } from 'date-fns'

import { useNow } from '@/time/useNow'

/** Nothing but the current time and today's date, large enough to read from across the room. */
export function ClockPage() {
  // The page fills the screen beneath the menus (whose 4.25rem RootLayout clears), so the clock sits in the middle.
  // Only minutes are shown, but updating every second keeps the time within a second of the minute changing.
  const now = useNow(1000)

  return (
    <main className="mx-auto grid w-full max-w-4xl min-h-[calc(100dvh-4.25rem)] place-items-center px-4 pb-10 text-center sm:pb-14">
      <div>
        <p className="font-heading text-7xl leading-none font-semibold tracking-tight tabular-nums sm:text-[10rem]">
          {format(now, 'HH:mm')}
        </p>
        <h1 className="mt-4 text-2xl font-semibold sm:text-5xl">{format(now, 'EEEE d MMMM yyyy')}</h1>
      </div>
    </main>
  )
}
