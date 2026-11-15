import { recordEdit, startHistory, undoEdit } from '@/pages/pixelArt/editHistory'

const BLANK = { rows: ['..'], palette: { o: '#ffd94a' } }
const LEFT = { rows: ['o.'], palette: { o: '#ffd94a' } }
const BOTH = { rows: ['oo'], palette: { o: '#ffd94a' } }

test('goes back to the work before the edit when undoing an edit', () => {
  const history = recordEdit(startHistory(BLANK), LEFT)

  const undone = undoEdit(history)

  expect(undone.present).toBe(BLANK)
})

test('undoes edits in the same group together when they come one after another', () => {
  const history = recordEdit(recordEdit(startHistory(BLANK), LEFT, 'stroke-1'), BOTH, 'stroke-1')

  const undone = undoEdit(history)

  expect(undone.present).toBe(BLANK)
})

test('undoes edits in different groups one at a time', () => {
  const history = recordEdit(recordEdit(startHistory(BLANK), LEFT, 'stroke-1'), BOTH, 'stroke-2')

  const undone = undoEdit(history)

  expect(undone.present).toBe(LEFT)
})

test('leaves the work as it is when there is nothing to undo', () => {
  const history = startHistory(BLANK)

  const undone = undoEdit(history)

  expect(undone.present).toBe(BLANK)
})
