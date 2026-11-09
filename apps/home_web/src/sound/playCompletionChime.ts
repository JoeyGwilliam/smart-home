// Browsers limit how many audio contexts a page can open, so every chime shares one, created on first use.
let sharedAudioContext: AudioContext | null = null

/** Plays a short "buh-bing" chime to celebrate ticking a reminder off. Plays nothing if the browser can't. */
export function playCompletionChime(): void {
  try {
    sharedAudioContext ??= new AudioContext()
    const startTime = sharedAudioContext.currentTime
    scheduleNote(sharedAudioContext, 659.25, startTime, 0.16, 0.22)
    scheduleNote(sharedAudioContext, 1318.51, startTime + 0.11, 0.8, 0.3)
  } catch (error) {
    // A missing sound isn't worth stopping the reminder from being ticked off, so this only leaves a trace for debugging.
    console.warn('Could not play the completion chime.', error)
  }
}

function scheduleNote(audioContext: AudioContext, frequency: number, startTime: number, durationSeconds: number, peakVolume: number): void {
  const envelope = audioContext.createGain()
  envelope.gain.setValueAtTime(0.0001, startTime)
  envelope.gain.exponentialRampToValueAtTime(peakVolume, startTime + 0.008)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds)
  envelope.connect(audioContext.destination)

  // A quiet overtone makes the note ring like a bell rather than sound like a plain beep.
  for (const [frequencyMultiple, relativeVolume] of [[1, 1], [2.76, 0.18]]) {
    const oscillator = audioContext.createOscillator()
    const overtoneVolume = audioContext.createGain()
    oscillator.frequency.value = frequency * frequencyMultiple
    overtoneVolume.gain.value = relativeVolume
    oscillator.connect(overtoneVolume).connect(envelope)
    oscillator.start(startTime)
    oscillator.stop(startTime + durationSeconds)
  }
}
