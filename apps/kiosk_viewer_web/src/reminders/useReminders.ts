import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'

import type { Reminder, ReminderContent } from '@/reminders/reminder'
import * as remindersApi from '@/reminders/remindersApi'

const REMINDERS_QUERY_KEY = ['reminders']

// A kiosk is left on one screen, so it refreshes by itself to show changes made from other devices.
const REFRESH_INTERVAL_MILLISECONDS = 30_000

/**
 * What happened to a change that was sent to the reminders API.
 *
 * - `saved`: the API holds the change.
 * - `invalid`: the API rejected the content, so the person needs to fix it.
 * - `unavailable`: the API couldn't be reached, so the person can try again later.
 */
export type SaveOutcome = 'saved' | 'invalid' | 'unavailable'

/** Changes to reminders. None of them throw: each reports its outcome instead. */
export interface ReminderActions {
  /** Adds a reminder once the API has accepted it. */
  createReminder: (content: ReminderContent) => Promise<SaveOutcome>
  /** Replaces a reminder. Shows the change straight away, and undoes it on screen if the API doesn't accept it. */
  saveReminder: (reminder: Reminder) => Promise<SaveOutcome>
  /** Deletes a reminder. Shows the change straight away, and undoes it on screen if the API can't be reached. */
  deleteReminder: (reminderId: string) => Promise<SaveOutcome>
}

/**
 * Keeps every reminder up to date, refreshing in the background.
 *
 * @returns The query, whose data is every reminder, oldest first. If a refresh fails, the last reminders that were
 *   fetched stay available alongside the error.
 */
export function useReminders(): UseQueryResult<Reminder[]> {
  return useQuery({
    queryKey: REMINDERS_QUERY_KEY,
    queryFn: remindersApi.listReminders,
    refetchInterval: REFRESH_INTERVAL_MILLISECONDS,
  })
}

/**
 * Provides the changes that can be made to reminders, keeping `useReminders` in step with them.
 *
 * @returns The actions.
 */
export function useReminderActions(): ReminderActions {
  const queryClient = useQueryClient()

  // Every change refetches afterwards, whatever its outcome, so that the screen always settles on what the API holds.
  const refetchReminders = () => queryClient.invalidateQueries({ queryKey: REMINDERS_QUERY_KEY })

  // Updates the cached reminders immediately, and returns a function that puts them back.
  const changeRemindersOnScreen = async (change: (reminders: Reminder[]) => Reminder[]) => {
    // A refresh that is already on its way would overwrite this change with older reminders.
    await queryClient.cancelQueries({ queryKey: REMINDERS_QUERY_KEY })
    const previousReminders = queryClient.getQueryData<Reminder[]>(REMINDERS_QUERY_KEY)
    queryClient.setQueryData<Reminder[]>(REMINDERS_QUERY_KEY, (reminders = []) => change(reminders))
    return () => queryClient.setQueryData(REMINDERS_QUERY_KEY, previousReminders)
  }

  const createMutation = useMutation({
    mutationFn: remindersApi.createReminder,
    onSettled: refetchReminders,
  })

  const saveMutation = useMutation({
    mutationFn: remindersApi.saveReminder,
    onMutate: (reminder: Reminder) =>
      changeRemindersOnScreen((reminders) => reminders.map((existing) => (existing.id === reminder.id ? reminder : existing))),
    onError: (_error, _reminder, undoChange) => undoChange?.(),
    onSettled: refetchReminders,
  })

  const deleteMutation = useMutation({
    mutationFn: remindersApi.deleteReminder,
    onMutate: (reminderId: string) => changeRemindersOnScreen((reminders) => reminders.filter((existing) => existing.id !== reminderId)),
    onError: (_error, _reminderId, undoChange) => undoChange?.(),
    onSettled: refetchReminders,
  })

  return {
    createReminder: (content) => reportOutcome(createMutation.mutateAsync(content)),
    saveReminder: (reminder) => reportOutcome(saveMutation.mutateAsync(reminder)),
    deleteReminder: (reminderId) => reportOutcome(deleteMutation.mutateAsync(reminderId)),
  }
}

async function reportOutcome(change: Promise<unknown>): Promise<SaveOutcome> {
  try {
    await change
    return 'saved'
  } catch (error) {
    // Callers show the outcome to the person, so the expected failures become outcomes rather than errors that every
    // caller would need to catch. Anything else is a bug, so it is left to crash.
    if (error instanceof remindersApi.InvalidReminderError) return 'invalid'
    if (error instanceof remindersApi.RemindersUnavailableError) return 'unavailable'
    throw error
  }
}
