import type { Assignee, Reminder, ReminderContent, Repeat } from '@/reminders/reminder'

// nginx.conf and vite.config.ts forward this to the reminders API.
const REMINDERS_URL = '/api/reminders'

/** The reminders API could not be reached, or failed to handle a request. */
export class RemindersUnavailableError extends Error {}

/** The reminders API rejected a reminder's content, which happens when its title is blank or it repeats without a due time. */
export class InvalidReminderError extends Error {}

/** A reminder as the API sends and receives it. */
interface ReminderJson {
  id: string
  title: string
  notes: string | null
  due_at: string | null
  completed_at: string | null
  repeats: Repeat | null
  assigned_to: Assignee | null
}

/**
 * Lists every reminder.
 *
 * @returns All reminders, oldest first.
 * @throws RemindersUnavailableError If the API is unavailable.
 */
export async function listReminders(): Promise<Reminder[]> {
  const response = await send('GET', REMINDERS_URL)
  const remindersJson: ReminderJson[] = await response.json()
  return remindersJson.map(parseReminder)
}

/**
 * Creates a reminder that isn't completed.
 *
 * @param content What the reminder says, and when it is due.
 * @returns The new reminder, with the id the API gave it.
 * @throws InvalidReminderError If the API rejects the content.
 * @throws RemindersUnavailableError If the API is unavailable.
 */
export async function createReminder(content: ReminderContent): Promise<Reminder> {
  const response = await send('POST', REMINDERS_URL, formatReminder({ ...content, completedAt: null }))
  return parseReminder(await response.json())
}

/**
 * Saves every part of a reminder, replacing what the API held. Recreates the reminder if it was deleted elsewhere.
 * Ticking off a repeating reminder also makes the API add the next one, which the next listing includes.
 *
 * @param reminder The reminder as it should now be.
 * @throws InvalidReminderError If the API rejects the content.
 * @throws RemindersUnavailableError If the API is unavailable.
 */
export async function saveReminder(reminder: Reminder): Promise<void> {
  await send('PUT', `${REMINDERS_URL}/${reminder.id}`, formatReminder(reminder))
}

/**
 * Ensures that a reminder no longer exists. Does nothing if it doesn't exist.
 *
 * @param reminderId Identifier of the reminder to delete.
 * @throws RemindersUnavailableError If the API is unavailable.
 */
export async function deleteReminder(reminderId: string): Promise<void> {
  await send('DELETE', `${REMINDERS_URL}/${reminderId}`)
}

async function send(method: string, url: string, body?: Omit<ReminderJson, 'id'>): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    // fetch only throws when the request never got a response. Callers can't recover from that any differently from a
    // server failure, so both become the one error they document.
    throw new RemindersUnavailableError('The reminders API could not be reached.', { cause: error })
  }

  // nginx answers 502 or 504 when the API container is down, which is the same situation as the API failing.
  if (response.status >= 500) {
    throw new RemindersUnavailableError(`The reminders API failed with status ${response.status}.`)
  }
  if (response.status === 422) {
    throw new InvalidReminderError('The reminders API rejected the reminder.')
  }
  if (!response.ok) {
    // Any other status means this client sent a request the API doesn't understand, which is a bug, not a condition.
    throw new Error(`The reminders API unexpectedly answered ${method} ${url} with status ${response.status}.`)
  }
  return response
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
    completed_at: formatTime(reminder.completedAt),
    repeats: reminder.repeats,
    assigned_to: reminder.assignedTo,
  }
}
