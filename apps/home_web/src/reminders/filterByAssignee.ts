import type { Assignee, Reminder } from '@/reminders/reminder'

/** Which reminders to show: everyone's, those for one person, or those that are for nobody in particular. */
export type AssigneeFilter = 'everyone' | 'nobody' | Assignee

/**
 * Picks the reminders that are for a person.
 *
 * @param reminders The reminders to choose from. Not modified.
 * @param filter Whose reminders to keep.
 * @returns The chosen reminders, in the order they were given.
 */
export function filterByAssignee(reminders: readonly Reminder[], filter: AssigneeFilter): Reminder[] {
  if (filter === 'everyone') return [...reminders]
  const assignedTo = filter === 'nobody' ? null : filter
  return reminders.filter((reminder) => reminder.assignedTo === assignedTo)
}
