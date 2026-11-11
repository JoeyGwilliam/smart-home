import { isBusy } from '@/siteEditor/change'

test.each(['working', 'building', 'saving'] as const)('is busy when the change is %s', (state) => {
  expect(isBusy(state)).toBe(true)
})

test.each(['idle', 'discussing', 'reviewing'] as const)('is not busy when the change is %s', (state) => {
  expect(isBusy(state)).toBe(false)
})
