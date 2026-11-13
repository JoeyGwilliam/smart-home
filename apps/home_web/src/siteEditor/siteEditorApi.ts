import { sendToHomeApi } from '@/homeApi/homeApi'
import type { Change, ChangeState, Commit, ProgressEvent } from '@/siteEditor/change'
import type { ClaudeSettings } from '@/siteEditor/claudeSettings'

// nginx.conf and vite.config.ts forward these to the site editor API.
const CHANGE_URL = '/api/site-editor/change'
const COMMITS_URL = '/api/site-editor/commits'

// The API refuses an action when the change isn't in a state that allows it, such as a message sent while Claude is
// still working. The RequestRefusedError that this causes says why, in words meant for the person.

/** The change as the API sends it. */
interface ChangeJson {
  state: ChangeState
  events: ProgressEvent[]
  changed_files: string[]
}

/** A commit as the API sends it. */
interface CommitJson {
  hash: string
  subject: string
  author: string
  committed_at: string
}

/**
 * Fetches the change that is being made to the site.
 *
 * @returns The change as it stands right now.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function getChange(): Promise<Change> {
  const response = await sendToHomeApi('site editor', 'GET', CHANGE_URL)
  const changeJson: ChangeJson = await response.json()
  return { state: changeJson.state, events: changeJson.events, changedFiles: changeJson.changed_files }
}

/**
 * Passes a message to Claude: a request for a change, or the next part of the conversation about one. Claude starts
 * work once the API accepts it; `getChange` shows the progress.
 *
 * @param text What the person wants, in their own words. Must not be blank.
 * @param claudeSettings How Claude should work on the message.
 * @throws RequestRefusedError If the site editor is busy, or the site's files have changes from elsewhere.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function sendMessage(text: string, claudeSettings: ClaudeSettings): Promise<void> {
  // The API leaves a choice to Claude Code when it is null.
  const model = claudeSettings.model === 'default' ? null : claudeSettings.model
  const effort = claudeSettings.effort === 'default' ? null : claudeSettings.effort
  await sendToHomeApi('site editor', 'POST', `${CHANGE_URL}/messages`, { text, model, effort })
}

/**
 * Interrupts Claude's work on the last message. Does nothing if Claude isn't working.
 *
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function stopClaude(): Promise<void> {
  await sendToHomeApi('site editor', 'POST', `${CHANGE_URL}/stop`)
}

/**
 * Keeps the change that is being previewed, which the API then commits.
 *
 * @throws RequestRefusedError If no change is being previewed.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function confirmChange(): Promise<void> {
  await sendToHomeApi('site editor', 'POST', `${CHANGE_URL}/confirm`)
}

/**
 * Abandons the change and ends the conversation about it. The API then puts the site back as it was. Does nothing if
 * no change is being made.
 *
 * @throws RequestRefusedError If the site editor is busy.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function discardChange(): Promise<void> {
  await sendToHomeApi('site editor', 'POST', `${CHANGE_URL}/discard`)
}

/**
 * Lists the most recent saved changes to the site.
 *
 * @returns The commits of the branch that the site is built from, newest first.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function listCommits(): Promise<Commit[]> {
  const response = await sendToHomeApi('site editor', 'GET', COMMITS_URL)
  const commitsJson: CommitJson[] = await response.json()
  return commitsJson.map((commitJson) => ({
    hash: commitJson.hash,
    subject: commitJson.subject,
    author: commitJson.author,
    committedAt: new Date(commitJson.committed_at),
  }))
}
