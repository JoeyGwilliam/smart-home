// Plays a "buh-bing" chime when a reminder is ticked off. The page works without this script, just silently.

// Saving reloads the page, which would cut the chime off, so the save waits until the chime has mostly finished.
const SAVE_DELAY_MILLISECONDS = 650;

function scheduleNote(audioContext, frequency, startTime, durationSeconds, peakVolume) {
  const envelope = audioContext.createGain();
  envelope.gain.setValueAtTime(0.0001, startTime);
  envelope.gain.exponentialRampToValueAtTime(peakVolume, startTime + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);
  envelope.connect(audioContext.destination);

  // A quiet overtone makes the note ring like a bell rather than sound like a plain beep.
  for (const [frequencyMultiple, relativeVolume] of [[1, 1], [2.76, 0.18]]) {
    const oscillator = audioContext.createOscillator();
    const overtoneVolume = audioContext.createGain();
    oscillator.frequency.value = frequency * frequencyMultiple;
    overtoneVolume.gain.value = relativeVolume;
    oscillator.connect(overtoneVolume).connect(envelope);
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSeconds);
  }
}

function scheduleCompletionChime(audioContext) {
  const startTime = audioContext.currentTime;
  scheduleNote(audioContext, 659.25, startTime, 0.16, 0.22);
  scheduleNote(audioContext, 1318.51, startTime + 0.11, 0.8, 0.3);
}

function playCompletionChime() {
  try {
    scheduleCompletionChime(new AudioContext());
  } catch (error) {
    // A missing sound isn't worth stopping the reminder from being ticked off, so this only leaves a trace for debugging.
    console.warn("Could not play the completion chime.", error);
  }
}

for (const form of document.querySelectorAll("form[data-completes-reminder]")) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.classList.contains("is-completing")) {
      return;
    }

    form.classList.add("is-completing");
    playCompletionChime();
    setTimeout(() => form.submit(), SAVE_DELAY_MILLISECONDS);
  });
}
