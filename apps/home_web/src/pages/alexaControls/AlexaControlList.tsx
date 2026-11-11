import type { ReactNode } from 'react'

import type { AlexaControl, PhrasePart } from '@/alexa/alexaControls'
import { Pill } from '@/components/Pill'

interface AlexaControlListProps {
  /** What people call the skill when they talk to Alexa, such as "home hub". */
  invocationName: string
  /** The controls to explain, in the order to show them. */
  controls: AlexaControl[]
}

/** Explains how to talk to an Alexa skill: how to start, then each control with the phrases that work for it. */
export function AlexaControlList({ invocationName, controls }: AlexaControlListProps) {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 pb-10 sm:pb-14">
      <header>
        <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">Talk to the house</p>
        <h1 className="mt-1 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">Alexa controls</h1>
      </header>

      <section className="panel rounded-4xl px-5 py-5 shadow-lg shadow-shade sm:px-7 sm:py-6" aria-label="How to start">
        <h2 className="mb-3">
          <Pill className="bg-butter text-[oklch(0.42_0.08_80)]">How to start</Pill>
        </h2>
        <p className="text-xl">
          Say <Quote>Alexa, ask {invocationName}</Quote> and then what you want, all in one go.
        </p>
        <p className="mt-2 text-lg text-muted-foreground">
          Or say <Quote>Alexa, open {invocationName}</Quote> and wait for it to answer. You can say <Quote>help</Quote> or{' '}
          <Quote>stop</Quote> at any time.
        </p>
      </section>

      {controls.map((control) => (
        <section key={control.intent} className="panel rounded-4xl px-5 py-5 shadow-lg shadow-shade sm:px-7 sm:py-6" aria-label={control.title}>
          <h2 className="font-heading text-3xl leading-tight font-semibold">{control.title}</h2>
          {control.answers !== null && (
            <p className="mt-2">
              <Pill className="bg-lavender text-[oklch(0.38_0.08_300)]">When it asks “{control.answers}”</Pill>
            </p>
          )}
          {control.description !== null && <p className="mt-2 text-lg text-muted-foreground">{control.description}</p>}
          <ul className="mt-4 grid gap-2" aria-label={`Ways to say “${control.title}”`}>
            {control.phrases.map((phrase) => {
              const phraseAsText = phrase.map((part) => part.text).join('')
              return (
                <li key={phraseAsText} className="rounded-2xl bg-accent px-4 py-2 text-lg font-semibold">
                  <Phrase parts={phrase} />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}

function Quote({ children }: { children: ReactNode }) {
  return <span className="font-bold text-primary-text">“{children}”</span>
}

/** A phrase to say, with each stand-in marked out from the words that are said as they are. */
function Phrase({ parts }: { parts: PhrasePart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.isStandIn ? (
          // The index is a safe key because a phrase's parts never change order.
          <em key={index} className="rounded-lg bg-peach px-1.5 py-0.5 text-base font-bold text-[oklch(0.42_0.1_40)] not-italic">
            {part.text}
          </em>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}
