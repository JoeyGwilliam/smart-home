import type { CSSProperties } from 'react'

interface Blob {
  className: string
  /** How long one drift takes, so that the blobs move out of step with each other. */
  driftDuration: string
}

// Mint and butter turn muddy on a dark background, so night mode swaps them for colours that glow like a dusk sky.
const BLOBS: Blob[] = [
  { className: '-top-32 -left-24 size-[28rem] bg-primary/45', driftDuration: '26s' },
  { className: 'top-1/3 -right-32 size-[30rem] bg-lavender/60', driftDuration: '34s' },
  { className: '-bottom-40 left-1/4 size-[26rem] bg-mint/60 dark:bg-sky/50', driftDuration: '30s' },
  { className: 'top-2/3 -left-40 size-[22rem] bg-butter/60 dark:bg-primary/50', driftDuration: '38s' },
]

/** Soft, slowly drifting colour behind the page, so that the frosted cards have something to frost. */
export function PastelBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-(--backdrop-opacity)" aria-hidden>
      {BLOBS.map((blob) => (
        <div
          key={blob.className}
          className={`animate-drift absolute rounded-full blur-3xl ${blob.className}`}
          style={{ '--drift-duration': blob.driftDuration } as CSSProperties}
        />
      ))}
    </div>
  )
}
