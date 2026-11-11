import { renderHook } from '@testing-library/react'

import { useSpokenAnnouncement } from '@/sound/useSpokenAnnouncement'

/** Stands in for the browser's speech, which jsdom doesn't have, and returns everything that is said. */
function stubSpeech(): string[] {
  const spokenTexts: string[] = []
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    text: string
    constructor(text: string) {
      this.text = text
    }
  })
  vi.stubGlobal('speechSynthesis', { speak: (utterance: { text: string }) => spokenTexts.push(utterance.text) })
  return spokenTexts
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('says nothing when the page loads with a topic', () => {
  const spokenTexts = stubSpeech()

  renderHook(() => useSpokenAnnouncement('shower', () => 'Time to start Shower.'))

  expect(spokenTexts).toEqual([])
})

test('reads the announcement aloud when the topic changes', () => {
  const spokenTexts = stubSpeech()
  const hook = renderHook(({ topic }) => useSpokenAnnouncement(topic, () => `Time to start ${topic}.`), { initialProps: { topic: 'shower' } })

  hook.rerender({ topic: 'makeup' })

  expect(spokenTexts).toEqual(['Time to start makeup.'])
})

test('says it once when the page renders again with the same topic', () => {
  const spokenTexts = stubSpeech()
  const hook = renderHook(({ topic }) => useSpokenAnnouncement(topic, () => `Time to start ${topic}.`), { initialProps: { topic: 'shower' } })

  hook.rerender({ topic: 'makeup' })
  hook.rerender({ topic: 'makeup' })

  expect(spokenTexts).toEqual(['Time to start makeup.'])
})

test('says nothing when the topic changes to null', () => {
  const spokenTexts = stubSpeech()
  const hook = renderHook(({ topic }: { topic: string | null }) => useSpokenAnnouncement(topic, () => 'Time to start.'), {
    initialProps: { topic: 'shower' as string | null },
  })

  hook.rerender({ topic: null })

  expect(spokenTexts).toEqual([])
})

test('carries on without speaking when the browser cannot speak', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const hook = renderHook(({ topic }) => useSpokenAnnouncement(topic, () => 'Time to start.'), { initialProps: { topic: 'shower' } })

  const changeTopic = () => hook.rerender({ topic: 'makeup' })

  expect(changeTopic).not.toThrow()
})
