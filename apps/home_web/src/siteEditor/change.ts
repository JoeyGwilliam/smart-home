/**
 * Where the change to the site has got to, which decides what can be done next.
 *
 * - `idle`: no change is being made. A message starts one.
 * - `working`: Claude is working on the last message. It can be stopped.
 * - `building`: the site is being rebuilt, to preview the change or to remove a discarded one.
 * - `discussing`: Claude has answered, and there is no preview to judge: either no files have changed, or the preview
 *   could not be built. A message carries the conversation on, and discarding ends it.
 * - `reviewing`: the running site shows the change, which is not yet saved. It can be confirmed, discarded, or refined
 *   with another message.
 * - `saving`: the confirmed change is being committed.
 */
export type ChangeState = 'idle' | 'working' | 'building' | 'discussing' | 'reviewing' | 'saving'

/** One thing that happened while a change was being made. */
export interface ProgressEvent {
  /**
   * What the event reports: something the person asked for, Claude thinking, a step being taken, something Claude
   * said, or a step that went wrong.
   */
  kind: 'request' | 'thinking' | 'activity' | 'reply' | 'failure'
  /** The event in words. For `thinking`, Claude's thoughts, which are empty when Claude doesn't share them. */
  text: string
}

/** The change to the site that is being made. There is always one, which is idle between changes. */
export interface Change {
  state: ChangeState
  /**
   * Everything that has happened in the conversation about the change, oldest first. Once a change is confirmed or
   * discarded, its events stay until the next change is started.
   */
  events: ProgressEvent[]
  /** The files that differ from the last saved change, as paths from the repository's root. */
  changedFiles: string[]
}

/** A saved change in the site's history. */
export interface Commit {
  /** The full hash that identifies the commit. */
  hash: string
  /** The first line of the commit's message. */
  subject: string
  /** The name of whoever made the change. */
  author: string
  committedAt: Date
}

/**
 * Checks whether the site editor is in the middle of something, during which it accepts nothing but a stop.
 *
 * @param state Where the change has got to.
 * @returns True while Claude is working, the site is being rebuilt, or the change is being saved.
 */
export function isBusy(state: ChangeState): boolean {
  return state === 'working' || state === 'building' || state === 'saving'
}
