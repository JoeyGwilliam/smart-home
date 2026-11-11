/**
 * A Claude model, by the name that Claude Code gives to the latest version of it. "default" leaves the choice to
 * Claude Code on the home server.
 */
export type ClaudeModel = 'default' | 'fable' | 'opus' | 'sonnet' | 'haiku'

/** How hard Claude thinks before it acts. "default" leaves the choice to the model. */
export type ClaudeEffort = 'default' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** How Claude should work on a message. */
export interface ClaudeSettings {
  model: ClaudeModel
  effort: ClaudeEffort
}

/** Every model that can be chosen, most capable first, with the name to show for it. */
export const CLAUDE_MODEL_CHOICES: { value: ClaudeModel; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'fable', label: 'Fable' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
]

/** Every effort that can be chosen, least first, with the name to show for it. */
export const CLAUDE_EFFORT_CHOICES: { value: ClaudeEffort; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' },
]
