import { describeRecipeTime } from '@/recipes/recipe'

test('gives only minutes when the time is under an hour', () => {
  expect(describeRecipeTime(45)).toBe('45 min')
})

test('gives only hours when the time is a whole number of hours', () => {
  expect(describeRecipeTime(120)).toBe('2 hr')
})

test('gives hours and minutes when the time is over an hour and not a whole number of hours', () => {
  expect(describeRecipeTime(90)).toBe('1 hr 30 min')
})
