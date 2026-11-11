import type { ReminderContent, Repeat } from '@/reminders/reminder'
import type { SaveOutcome } from '@/reminders/useReminders'

/** A reminder's content while someone is writing it, in the form the fields hold it. */
export interface ReminderDraft {
  title: string
  /** Empty when there are no notes. */
  notes: string
  dueAt: Date | null
  /** Kept while the due time is removed, so that adding a due time back brings the repeat back too. */
  repeats: Repeat | null
}

/**
 * Creates a draft to edit.
 *
 * @param content Content to start from. Defaults to an empty reminder.
 * @returns The draft.
 */
export function createDraft(content?: ReminderContent): ReminderDraft {
  return { title: content?.title ?? '', notes: content?.notes ?? '', dueAt: content?.dueAt ?? null, repeats: content?.repeats ?? null }
}

/**
 * Whether a draft can be saved. The reminders API rejects a reminder whose title is blank, so this lets a form stop
 * that before sending it.
 */
export function isDraftComplete(draft: ReminderDraft): boolean {
  return draft.title.trim() !== ''
}

/**
 * Converts a draft into the content of a reminder, tidying away surrounding whitespace.
 *
 * @param draft The draft.
 * @returns The content, with blank notes treated as no notes, and no repeat if there is no due time to repeat from.
 */
export function toReminderContent(draft: ReminderDraft): ReminderContent {
  return { title: draft.title.trim(), notes: draft.notes.trim() || null, dueAt: draft.dueAt, repeats: draft.dueAt ? draft.repeats : null }
}

/**
 * Explains to the person why their reminder wasn't saved.
 *
 * @param outcome The outcome of a save that didn't succeed.
 * @returns A sentence to show beside the form.
 */
export function describeSaveFailure(outcome: Exclude<SaveOutcome, 'saved'>): string {
  return outcome === 'invalid'
    ? "That reminder couldn't be saved. Check that it has a title, and a due time if it repeats."
    : "Couldn't reach your reminders. Your changes are still here, so try again in a moment."
}
