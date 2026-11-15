/** Something being worked on, such as a drawing or a scene, and how it was before each edit, so that edits can be undone. */
export interface EditHistory<Work> {
  /** How the work was before each edit, oldest first. */
  past: Work[]
  present: Work
  /** The group of the latest edit (see recordEdit), or null if it wasn't in one. */
  latestGroup: string | null
}

/**
 * Starts working on something.
 *
 * @param work The work as it is to begin with.
 * @returns A history with nothing to undo.
 */
export function startHistory<Work>(work: Work): EditHistory<Work> {
  return { past: [], present: work, latestGroup: null }
}

/**
 * Records an edit. Edits in the same group, one straight after another, are undone together, such as every pixel
 * painted in one stroke, or every step of dragging a picture across a scene.
 *
 * @param history The history so far.
 * @param work The work after the edit.
 * @param group Names the group that the edit belongs to, or is left out for an edit of its own.
 * @returns The history with the edit recorded.
 */
export function recordEdit<Work>(history: EditHistory<Work>, work: Work, group?: string): EditHistory<Work> {
  const isSameGroup = group !== undefined && group === history.latestGroup
  return { past: isSameGroup ? history.past : [...history.past, history.present], present: work, latestGroup: group ?? null }
}

/**
 * Undoes the latest edit, or group of edits. Does nothing if there is nothing to undo.
 *
 * @param history The history so far.
 * @returns The history with the work as it was before.
 */
export function undoEdit<Work>(history: EditHistory<Work>): EditHistory<Work> {
  if (history.past.length === 0) return history
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], latestGroup: null }
}
