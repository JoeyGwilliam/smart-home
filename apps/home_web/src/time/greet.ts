/**
 * Greets the person for the time of day.
 *
 * @param now The current time.
 * @returns "Good morning", "Good afternoon" or "Good evening".
 */
export function greet(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
