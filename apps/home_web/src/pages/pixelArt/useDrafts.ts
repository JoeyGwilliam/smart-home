import { useState } from 'react'

import { recordEdit, startHistory, undoEdit, type EditHistory } from '@/pages/pixelArt/editHistory'
import { isSameDesign } from '@/scenes/editScene'

/** Unsaved work on scenes or layers, each kept under its id until it is saved or discarded. */
export interface Drafts<Design> {
  /** Gives the work on a design: the draft if it has one, or else the design as it is saved. */
  draftOf: (id: string, saved: Design) => Design
  /** Whether a design has a draft that differs from how it is saved. */
  hasUnsavedChanges: (id: string, saved: Design) => boolean
  /** Whether a design has an edit to undo. */
  canUndo: (id: string) => boolean
  /**
   * Edits a design. The edit is given the draft as it is at that moment, as a drag can make several edits before the
   * page next draws itself. Edits sharing a group are undone together (see recordEdit).
   */
  edit: (id: string, saved: Design, change: (draft: Design) => Design, group?: string) => void
  undo: (id: string) => void
  /** Discards a design's draft, as when it has been saved. */
  forget: (id: string) => void
}

/**
 * Keeps unsaved work on any number of scenes or layers, so that moving between them loses nothing.
 *
 * @returns The drafts.
 */
export function useDrafts<Design extends object>(): Drafts<Design> {
  const [histories, setHistories] = useState<Record<string, EditHistory<Design>>>({})

  return {
    draftOf: (id, saved) => histories[id]?.present ?? saved,
    hasUnsavedChanges: (id, saved) => histories[id] !== undefined && !isSameDesign(histories[id].present, saved),
    canUndo: (id) => (histories[id]?.past.length ?? 0) > 0,
    edit: (id, saved, change, group) =>
      setHistories((previous) => {
        const history = previous[id] ?? startHistory(saved)
        return { ...previous, [id]: recordEdit(history, change(history.present), group) }
      }),
    undo: (id) => setHistories((previous) => (previous[id] ? { ...previous, [id]: undoEdit(previous[id]) } : previous)),
    forget: (id) => setHistories(({ [id]: _forgotten, ...others }) => others),
  }
}
