import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import type { AlexaControl, AlexaControlGroup, PhrasePart } from '@/alexa/alexaControls'
import { Pill } from '@/components/Pill'

interface AlexaControlListProps {
  /** What people call the skill when they talk to Alexa, such as "home hub". */
  invocationName: string
  /** The controls to explain, grouped by the part of the home that they work on, in the order to show them. */
  groups: AlexaControlGroup[]
}

/**
 * Explains how to talk to an Alexa skill: how to start, then the controls for each part of the home. Everything
 * starts folded away, so that the page is a short list of what the skill covers: a group opens to show its controls,
 * and a control opens to show what it does and the phrases that work for it.
 */
export function AlexaControlList({ invocationName, groups }: AlexaControlListProps) {
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

      {groups.map((group) => (
        // Native details elements fold and unfold by themselves, and work with a keyboard and a screen reader.
        <details key={group.title} className="group/section panel rounded-4xl shadow-lg shadow-shade">
          <summary className={`${SUMMARY_CLASS_NAME} rounded-4xl px-5 py-4 sm:px-7 sm:py-5`}>
            <h2 className="font-heading text-3xl leading-tight font-semibold">{group.title}</h2>
            <Pill className="ml-auto bg-accent text-primary-text">{group.controls.length}</Pill>
            <ChevronDown className="size-6 shrink-0 text-muted-foreground transition-transform group-open/section:rotate-180" aria-hidden />
          </summary>
          <div className="grid gap-2 px-3 pb-4 sm:px-5 sm:pb-5">
            {group.controls.map((control) => (
              <ControlDetails key={control.intent} control={control} />
            ))}
          </div>
        </details>
      ))}
    </main>
  )
}

// Hides the browser's own disclosure triangle, which a chevron on the right replaces.
const SUMMARY_CLASS_NAME = 'flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden'

/** One control, folded down to its title until it is opened. */
function ControlDetails({ control }: { control: AlexaControl }) {
  return (
    <details className="group/control rounded-2xl bg-accent">
      <summary className={`${SUMMARY_CLASS_NAME} rounded-2xl px-4 py-3`}>
        <h3 className="text-xl font-bold">{control.title}</h3>
        <ChevronDown className="ml-auto size-5 shrink-0 text-muted-foreground transition-transform group-open/control:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4">
        {control.answers !== null && (
          <p className="mb-2">
            <Pill className="bg-lavender text-[oklch(0.38_0.08_300)]">When it asks “{control.answers}”</Pill>
          </p>
        )}
        {control.description !== null && <p className="text-lg text-muted-foreground">{control.description}</p>}
        <ul className="mt-3 grid gap-1.5" aria-label={`Ways to say “${control.title}”`}>
          {control.phrases.map((phrase) => {
            const phraseAsText = phrase.map((part) => part.text).join('')
            return (
              <li key={phraseAsText} className="rounded-xl bg-card px-3 py-1.5 text-lg font-semibold">
                <Phrase parts={phrase} />
              </li>
            )
          })}
        </ul>
      </div>
    </details>
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
