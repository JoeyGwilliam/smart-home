import { format } from 'date-fns'
import type { ReactNode } from 'react'

import { Pill } from '@/components/Pill'
import { useNow } from '@/time/useNow'
import { IDIOMS } from '@/words/idioms'
import { MANDARIN_WORDS } from '@/words/mandarinWords'
import { pickForDay } from '@/words/pickForDay'
import { SPANISH_WORDS } from '@/words/spanishWords'

/** Something new to learn each day: an English idiom, a Spanish word and a Mandarin word, which change at midnight. */
export function WordOfTheDayPage() {
  const now = useNow()
  const idiom = pickForDay(IDIOMS, now)
  const spanishWord = pickForDay(SPANISH_WORDS, now)
  const mandarinWord = pickForDay(MANDARIN_WORDS, now)

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 pb-10 sm:pb-14">
      <header>
        <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">{format(now, 'EEEE d MMMM')}</p>
        <h1 className="mt-1 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">Word of the day</h1>
      </header>

      <WordCard title="English idiom" titleClassName="bg-butter text-[oklch(0.42_0.08_80)]">
        <Word>{idiom.phrase}</Word>
        <Translation>{idiom.meaning}</Translation>
      </WordCard>

      <WordCard title="Spanish" titleClassName="bg-peach text-[oklch(0.42_0.1_40)]">
        <Word language="es">{spanishWord.word}</Word>
        <Translation>{spanishWord.translation}</Translation>
      </WordCard>

      <WordCard title="Mandarin" titleClassName="bg-lavender text-[oklch(0.38_0.08_300)]">
        <Word language="zh-Hans">{mandarinWord.characters}</Word>
        {/* Marked as pinyin so that screen readers pronounce it as Mandarin rather than as English. */}
        <p lang="zh-Latn-pinyin" className="mt-1 text-2xl font-bold text-primary-text">
          {mandarinWord.pinyin}
        </p>
        <Translation>{mandarinWord.translation}</Translation>
      </WordCard>
    </main>
  )
}

interface WordCardProps {
  /** Names what the card teaches, such as "Spanish". */
  title: string
  /** The colours of the title's pill. */
  titleClassName: string
  children: ReactNode
}

function WordCard({ title, titleClassName, children }: WordCardProps) {
  return (
    <section className="panel rounded-4xl px-5 py-5 shadow-lg shadow-shade sm:px-7 sm:py-6" aria-label={title}>
      <h2 className="mb-3">
        <Pill className={titleClassName}>{title}</Pill>
      </h2>
      {children}
    </section>
  )
}

/** The word or phrase being taught. `language` is its language tag when it isn't English, so it is read out correctly. */
function Word({ language, children }: { language?: string; children: ReactNode }) {
  return (
    <p lang={language} className="font-heading text-4xl leading-tight font-semibold break-words sm:text-5xl">
      {children}
    </p>
  )
}

function Translation({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xl text-muted-foreground">{children}</p>
}
