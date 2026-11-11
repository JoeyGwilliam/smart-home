import { useEffect, useRef } from 'react'

/**
 * Reads an announcement aloud each time there is something new to announce. Says nothing if the browser can't speak,
 * or won't: most browsers stay silent until the person has pressed something on the page.
 *
 * @param topic Identifies what there is to announce, or null when there is nothing. An announcement is made whenever
 *   this changes to something else that isn't null. The topic a page loads with is not announced, so that a reload
 *   doesn't repeat what has already been said.
 * @param describe Writes the announcement for the current topic. Only called when an announcement is made.
 */
export function useSpokenAnnouncement(topic: string | null, describe: () => string): void {
  const lastTopic = useRef(topic)

  // This runs after every render, as `describe` is a new function each time, and the comparison below is what makes
  // sure that only a new topic is announced.
  useEffect(() => {
    if (topic === lastTopic.current) return
    lastTopic.current = topic
    if (topic !== null) speak(describe())
  })
}

function speak(text: string): void {
  try {
    speechSynthesis.speak(new SpeechSynthesisUtterance(text))
  } catch (error) {
    // A missed announcement isn't worth breaking the page that made it, so this only leaves a trace for debugging.
    console.warn('Could not read an announcement aloud.', error)
  }
}
