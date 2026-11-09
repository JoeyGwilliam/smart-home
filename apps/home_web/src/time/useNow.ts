import { useEffect, useState } from 'react'

// Countdowns are shown in whole hours, so updating twice a minute keeps them correct without wasted renders.
const DEFAULT_UPDATE_INTERVAL_MILLISECONDS = 30_000

/**
 * Provides the current time, updating it regularly so that anything derived from it stays correct on a screen that
 * is left open.
 *
 * @param updateIntervalMilliseconds How often to update. Defaults to twice a minute, which suits anything shown to
 *   the hour; a clock needs updates every second.
 * @returns The current time, as of the last update.
 */
export function useNow(updateIntervalMilliseconds = DEFAULT_UPDATE_INTERVAL_MILLISECONDS): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), updateIntervalMilliseconds)
    return () => clearInterval(interval)
  }, [updateIntervalMilliseconds])

  return now
}
