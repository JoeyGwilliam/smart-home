import { differenceInCalendarDays } from 'date-fns'

// Any fixed day would do: days are counted from it only to step through a list one entry per day.
const FIRST_DAY = new Date(2000, 0, 1)

/**
 * Picks the entry of a list that belongs to a day. The list is stepped through in order, one entry per calendar day
 * on this device's clock, and starts again once it runs out.
 *
 * @param entries The list to pick from, which must not be empty.
 * @param day Any time during the day to pick for.
 * @returns The same entry for every time within one day, and the next entry for the day after.
 */
export function pickForDay<Entry>(entries: Entry[], day: Date): Entry {
  const dayNumber = differenceInCalendarDays(day, FIRST_DAY)
  // The remainder is negative for days before the first day, so it is shifted back into the list.
  const index = ((dayNumber % entries.length) + entries.length) % entries.length
  return entries[index]
}
