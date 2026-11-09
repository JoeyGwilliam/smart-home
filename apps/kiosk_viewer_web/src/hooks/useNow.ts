import { useEffect, useState } from 'react'

// Countdowns are shown in whole hours, so updating twice a minute keeps them correct without wasted renders.
const UPDATE_INTERVAL_MILLISECONDS = 30_000

/**
 * Provides the current time, updating it regularly so that anything derived from it stays correct on a screen that
 * is left open.
 *
 * @returns The current time, as of the last update.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), UPDATE_INTERVAL_MILLISECONDS)
    return () => clearInterval(interval)
  }, [])

  return now
}
