import { sendToHomeApi } from '@/homeApi/homeApi'
import type { Assignee, Reminder, ReminderContent, Repeat } from '@/reminders/reminder'

// nginx.conf and vite.config.ts forward this to the reminders API.
const REMINDERS_URL = '/api/reminders'

/** A reminder as the API sends and receives it. */
interface ReminderJson {
  id: string
  title: string
  notes: string | null
  due_at: string | null
  is_all_day: boolean
  completed_at: string | null
  repeats: Repeat | null
  assigned_to: Assignee | null
}

/**
 * Lists every reminder.
 *
 * @returns All reminders, oldest first.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function listReminders(): Promise<Reminder[]> {
  const response = await sendToHomeApi('reminders', 'GET', REMINDERS_URL)
  const remindersJson: ReminderJson[] = await response.json()
  return remindersJson.map(parseReminder)
}

/**
 * Creates a reminder that isn't completed.
 *
 * @param content What the reminder says, and when it is due.
 * @returns The new reminder, with the id the API gave it.
 * @throws RequestRefusedError If the API rejects the content, which happens when the title is blank or the reminder
 *   repeats or is all day without a due time.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function createReminder(content: ReminderContent): Promise<Reminder> {
  const response = await sendToHomeApi('reminders', 'POST', REMINDERS_URL, formatReminder({ ...content, completedAt: null }))
  return parseReminder(await response.json())
}

/**
 * Saves every part of a reminder, replacing what the API held. Recreates the reminder if it was deleted elsewhere.
 * Ticking off a repeating reminder also makes the API add the next one, which the next listing includes.
 *
 * @param reminder The reminder as it should now be.
 * @throws RequestRefusedError If the API rejects the content, which happens when the title is blank or the reminder
 *   repeats or is all day without a due time.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function saveReminder(reminder: Reminder): Promise<void> {
  await sendToHomeApi('reminders', 'PUT', `${REMINDERS_URL}/${reminder.id}`, formatReminder(reminder))
}

/**
 * Ensures that a reminder no longer exists. Does nothing if it doesn't exist.
 *
 * @param reminderId Identifier of the reminder to delete.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function deleteReminder(reminderId: string): Promise<void> {
  await sendToHomeApi('reminders', 'DELETE', `${REMINDERS_URL}/${reminderId}`)
}

function parseTime(text: string | null): Date | null {
  return text ? new Date(text) : null
}

function formatTime(moment: Date | null): string | null {
  return moment ? moment.toISOString() : null
}

function parseReminder(reminderJson: ReminderJson): Reminder {
  return {
    id: reminderJson.id,
    title: reminderJson.title,
    notes: reminderJson.notes,
    dueAt: parseTime(reminderJson.due_at),
    isAllDay: reminderJson.is_all_day,
    completedAt: parseTime(reminderJson.completed_at),
    repeats: reminderJson.repeats,
    assignedTo: reminderJson.assigned_to,
  }
}

function formatReminder(reminder: Omit<Reminder, 'id'>): Omit<ReminderJson, 'id'> {
  return {
    title: reminder.title,
    notes: reminder.notes,
    due_at: formatTime(reminder.dueAt),
    is_all_day: reminder.isAllDay,
    completed_at: formatTime(reminder.completedAt),
    repeats: reminder.repeats,
    assigned_to: reminder.assignedTo,
  }
}
