import { describeMoonPhase } from '@/scene/describeMoonPhase'

test('gives a phase near a half when the moon is full', () => {
  const phase = describeMoonPhase(new Date('2024-01-25T17:54:00Z'))

  expect(phase).toBeCloseTo(0.5, 1)
})

test('gives a phase near a quarter when the moon is at its first quarter', () => {
  const phase = describeMoonPhase(new Date('2024-01-18T03:53:00Z'))

  expect(phase).toBeCloseTo(0.25, 1)
})

test('gives a phase near three quarters when the moon is at its last quarter', () => {
  const phase = describeMoonPhase(new Date('2024-02-02T23:18:00Z'))

  expect(phase).toBeCloseTo(0.75, 1)
})

test('gives a phase within the cycle when the time is before the reference new moon', () => {
  const phase = describeMoonPhase(new Date('1999-12-22T17:31:00Z'))

  expect(phase).toBeCloseTo(0.5, 1)
})
