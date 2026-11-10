// The moon's cycle is counted from a known new moon, using the average length of a cycle.
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
const CYCLE_MILLISECONDS = 29.530588853 * 24 * 3_600_000

/**
 * Works out how far the moon is through its cycle.
 *
 * @param now The time to describe the moon at.
 * @returns The phase, from 0 up to, but not including, 1: 0 is a new moon and 0.5 a full moon. Real cycles vary a
 *   little in length, so this can be out by up to half a day, which is too little to see.
 */
export function describeMoonPhase(now: Date): number {
  const cycles = (now.getTime() - KNOWN_NEW_MOON) / CYCLE_MILLISECONDS
  return cycles - Math.floor(cycles)
}
