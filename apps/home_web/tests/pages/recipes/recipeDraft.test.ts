import { createDraft, isDraftComplete, toRecipeToSave } from '@/pages/recipes/recipeDraft'

const COMPLETE_DRAFT = { name: 'Beans on toast', ingredients: 'Beans\nToast', instructions: '', timeMinutes: '', picture: null }

test('puts each ingredient on its own line when starting from a recipe', () => {
  const draft = createDraft({ id: 'abc', name: 'Beans on toast', ingredients: ['Beans', 'Toast'], instructions: null, timeMinutes: 5, pictureId: 'pic' })

  expect(draft).toEqual({ name: 'Beans on toast', ingredients: 'Beans\nToast', instructions: '', timeMinutes: '5', picture: 'pic' })
})

test('is complete when it has a name and an ingredient', () => {
  expect(isDraftComplete(COMPLETE_DRAFT)).toBe(true)
})

test('is not complete when the name is blank', () => {
  expect(isDraftComplete({ ...COMPLETE_DRAFT, name: '  ' })).toBe(false)
})

test('is not complete when every ingredient line is blank', () => {
  expect(isDraftComplete({ ...COMPLETE_DRAFT, ingredients: '\n  \n' })).toBe(false)
})

test('is not complete when the time is not a whole number of minutes', () => {
  expect(isDraftComplete({ ...COMPLETE_DRAFT, timeMinutes: '2.5' })).toBe(false)
})

test('is not complete when the time is zero', () => {
  expect(isDraftComplete({ ...COMPLETE_DRAFT, timeMinutes: '0' })).toBe(false)
})

test('drops blank lines and surrounding spaces from ingredients when converting', () => {
  const recipe = toRecipeToSave({ ...COMPLETE_DRAFT, ingredients: ' Beans \n\n  Toast\n' }, null)

  expect(recipe.ingredients).toEqual(['Beans', 'Toast'])
})

test('treats blank instructions and time as none when converting', () => {
  const recipe = toRecipeToSave({ ...COMPLETE_DRAFT, instructions: '  \n', timeMinutes: '' }, 'abc')

  expect(recipe).toEqual({ id: 'abc', name: 'Beans on toast', ingredients: ['Beans', 'Toast'], instructions: null, timeMinutes: null, picture: null })
})

test('converts the time to a number when converting', () => {
  const recipe = toRecipeToSave({ ...COMPLETE_DRAFT, timeMinutes: '45' }, null)

  expect(recipe.timeMinutes).toBe(45)
})
