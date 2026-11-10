import { render, screen, within } from '@testing-library/react'

import { WordOfTheDayPage } from '@/pages/wordOfTheDay/WordOfTheDayPage'

afterEach(() => {
  vi.useRealTimers()
})

test('shows an idiom with its meaning when the first day of the lists comes round', () => {
  vi.useFakeTimers({ now: new Date(2000, 0, 1, 9) })

  render(<WordOfTheDayPage />)

  const card = within(screen.getByRole('region', { name: 'English idiom' }))
  expect(card.getByText('A blessing in disguise')).toBeInTheDocument()
  expect(card.getByText('Something that seems bad at first but turns out well.')).toBeInTheDocument()
})

test('shows a Spanish word with its translation when the first day of the lists comes round', () => {
  vi.useFakeTimers({ now: new Date(2000, 0, 1, 9) })

  render(<WordOfTheDayPage />)

  const card = within(screen.getByRole('region', { name: 'Spanish' }))
  expect(card.getByText('la madrugada')).toBeInTheDocument()
  expect(card.getByText('the early hours, between midnight and dawn')).toBeInTheDocument()
})

test('shows a Mandarin word with its pinyin and translation when the first day of the lists comes round', () => {
  vi.useFakeTimers({ now: new Date(2000, 0, 1, 9) })

  render(<WordOfTheDayPage />)

  const card = within(screen.getByRole('region', { name: 'Mandarin' }))
  expect(card.getByText('你好')).toBeInTheDocument()
  expect(card.getByText('nǐ hǎo')).toBeInTheDocument()
  expect(card.getByText('hello')).toBeInTheDocument()
})

test('shows different words when the next day comes round', () => {
  vi.useFakeTimers({ now: new Date(2000, 0, 2, 9) })

  render(<WordOfTheDayPage />)

  expect(screen.getByText('Once in a blue moon')).toBeInTheDocument()
  expect(screen.getByText('la sobremesa')).toBeInTheDocument()
  expect(screen.getByText('谢谢')).toBeInTheDocument()
})
