import { Check, CircleStop, CloudOff, SendHorizontal, Undo2 } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CommitHistory } from '@/pages/siteEditor/CommitHistory'
import { Conversation } from '@/pages/siteEditor/Conversation'
import { useSettings } from '@/settings/useSettings'
import { isBusy, type Change } from '@/siteEditor/change'
import { CLAUDE_EFFORT_CHOICES, CLAUDE_MODEL_CHOICES, type ClaudeEffort, type ClaudeModel } from '@/siteEditor/claudeSettings'
import { useSiteEditor, type SiteEditor } from '@/siteEditor/useSiteEditor'

// Served by the site editor API itself, so it still works when a change has broken this app (see nginx.conf).
const RESCUE_PAGE_URL = '/api/site-editor/rescue'

/**
 * Changes this site by asking for what you want in words. Claude makes the change on the server, and the site is
 * rebuilt to show it, without saving it. From there it can be kept, discarded, or refined by carrying on the
 * conversation. Below is the history of the changes that were kept.
 */
export function SiteEditorPage() {
  const siteEditor = useSiteEditor()
  const { change, commits } = siteEditor

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 pb-10 sm:pb-14">
      <header>
        <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">Ask for a change</p>
        <h1 className="mt-1 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">Site editor</h1>
      </header>

      {siteEditor.isUnavailable && (
        <Panel title="Can't reach the site editor">
          <p className="flex items-center gap-2 text-muted-foreground">
            <CloudOff className="size-4 shrink-0" aria-hidden />
            It runs on the home server, and may not have been started.
          </p>
        </Panel>
      )}

      {change && (
        <Panel title="Change">
          <div className="grid gap-4">
            {change.events.length > 0 && <Conversation change={change} />}
            <ChangeActions siteEditor={siteEditor} change={change} />
            <MessageForm siteEditor={siteEditor} change={change} />
            {siteEditor.refusal && (
              <p className="text-sm font-semibold text-destructive" role="alert">
                {siteEditor.refusal}
              </p>
            )}
          </div>
        </Panel>
      )}

      {commits && (
        <Panel title="History">
          <CommitHistory commits={commits} />
        </Panel>
      )}

      <p className="text-center text-sm text-muted-foreground">
        If a change breaks this page, discard it from the{' '}
        <a href={RESCUE_PAGE_URL} className="font-bold underline">
          rescue page
        </a>
        .
      </p>
    </main>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel rounded-4xl px-5 py-5 shadow-lg shadow-shade sm:px-7 sm:py-6" aria-label={title}>
      <h2 className="mb-3 font-heading text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** What can be decided about the change in its current state: stopping Claude, or keeping or discarding its work. */
function ChangeActions({ siteEditor, change }: { siteEditor: SiteEditor; change: Change }) {
  if (change.state === 'working') {
    return (
      <div>
        <Button variant="outline" onClick={siteEditor.stopClaude}>
          <CircleStop />
          Stop
        </Button>
      </div>
    )
  }

  if (change.state === 'reviewing') {
    return (
      <div className="grid gap-3 rounded-3xl bg-field p-4">
        <p className="font-semibold">The site now shows this change, but it isn't saved yet. Have a look around, then decide.</p>
        <ChangedFiles files={change.changedFiles} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={siteEditor.confirmChange}>
            <Check />
            Keep it
          </Button>
          <Button variant="destructive" onClick={siteEditor.discardChange}>
            <Undo2 />
            Discard it
          </Button>
        </div>
      </div>
    )
  }

  if (change.state === 'discussing') {
    const hasChangedFiles = change.changedFiles.length > 0
    return (
      <div className="grid gap-3 rounded-3xl bg-field p-4">
        {hasChangedFiles && (
          <>
            <p className="font-semibold">Some files have changed, but the site doesn't show them. Ask Claude to carry on, or discard them.</p>
            <ChangedFiles files={change.changedFiles} />
          </>
        )}
        <div>
          <Button variant="destructive" onClick={siteEditor.discardChange}>
            <Undo2 />
            {hasChangedFiles ? 'Discard it' : 'End the conversation'}
          </Button>
        </div>
      </div>
    )
  }

  return null
}

function ChangedFiles({ files }: { files: string[] }) {
  return (
    <details className="text-sm text-muted-foreground">
      <summary className="cursor-pointer font-bold">
        {files.length} changed {files.length === 1 ? 'file' : 'files'}
      </summary>
      <ul className="mt-1 grid gap-0.5">
        {files.map((file) => (
          <li key={file} className="break-all">
            <code>{file}</code>
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * The box for writing to Claude, with the choice of model and effort for Claude to work on the message with. The
 * choices are remembered by this device. It can't be used while the site editor is busy.
 */
function MessageForm({ siteEditor, change }: { siteEditor: SiteEditor; change: Change }) {
  const [text, setText] = useState('')
  const [settings, changeSettings] = useSettings()
  const canSend = !isBusy(change.state) && text.trim() !== ''

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!canSend) return
    // The text stays in the box if the message isn't accepted, so that it can be sent again.
    const claudeSettings = { model: settings.claudeModel, effort: settings.claudeEffort }
    if (await siteEditor.sendMessage(text.trim(), claudeSettings)) setText('')
  }

  // Enter sends, as in a chat. Shift+Enter starts a new line.
  const sendOnEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) void sendMessage(event)
  }

  return (
    <form onSubmit={sendMessage} className="grid gap-2">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={sendOnEnter}
        disabled={isBusy(change.state)}
        aria-label="Message"
        placeholder={change.state === 'idle' ? 'What would you like to change?' : 'Ask for something more, or answer Claude…'}
        className="bg-field"
      />
      <div className="flex flex-wrap items-end gap-3">
        <ChoiceField
          label="Model"
          choices={CLAUDE_MODEL_CHOICES}
          value={settings.claudeModel}
          onChange={(claudeModel: ClaudeModel) => changeSettings({ claudeModel })}
        />
        <ChoiceField
          label="Effort"
          choices={CLAUDE_EFFORT_CHOICES}
          value={settings.claudeEffort}
          onChange={(claudeEffort: ClaudeEffort) => changeSettings({ claudeEffort })}
        />
        <Button type="submit" disabled={!canSend} className="ml-auto h-11 rounded-full px-5 text-base font-bold">
          <SendHorizontal />
          Send
        </Button>
      </div>
    </form>
  )
}

interface ChoiceFieldProps<Value extends string> {
  /** Names what is being chosen, such as "Model". */
  label: string
  choices: { value: Value; label: string }[]
  value: Value
  onChange: (value: Value) => void
}

/** A labelled drop-down for choosing one of a few values. */
function ChoiceField<Value extends string>({ label, choices, value, onChange }: ChoiceFieldProps<Value>) {
  return (
    <label className="grid gap-1 text-sm font-bold text-muted-foreground">
      {label}
      <select
        value={value}
        // The options are exactly the choices, so the chosen value is always one of them.
        onChange={(event) => onChange(event.target.value as Value)}
        className="h-11 rounded-full border border-input bg-field px-3 text-base font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  )
}
