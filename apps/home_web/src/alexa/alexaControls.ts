/** One piece of a phrase: either words to say as they are, or a stand-in for something the person chooses. */
export interface PhrasePart {
  /** The words to say, or for a stand-in, a description of what to say there, such as "a day". */
  text: string
  /** Whether this is a stand-in rather than words to say as they are. */
  isStandIn: boolean
}

/** Something that a person can do by talking to the home's Alexa skill. */
export interface AlexaControl {
  /** The skill's name for the control, which is unique. */
  intent: string
  /** Names what the control does, such as "Add a reminder". */
  title: string
  /** Explains what happens when the control is used. Null if nobody has described the control yet. */
  description: string | null
  /** The question from the skill that the control answers. Null for a control that can be used at any time. */
  answers: string | null
  /** Every way of saying it that the skill was taught. The skill often understands close variations too. */
  phrases: PhrasePart[][]
}

/** The controls for one part of the home, such as its reminders. */
export interface AlexaControlGroup {
  /** Names the part of the home, such as "Reminders". Unique among the groups. */
  title: string
  /** The group's controls, in the order to show them. Never empty. */
  controls: AlexaControl[]
}

/** The part of the skill's interaction model (interactionModels/custom/en-GB.json) that the controls come from. */
export interface InteractionModel {
  interactionModel: {
    languageModel: {
      invocationName: string
      intents: { name: string; samples?: string[] }[]
    }
  }
}

/** What the interaction model can't say about the controls (the skill's control-descriptions.json). */
export interface ControlDescriptions {
  /** What to say in place of each slot, by slot name, such as "a day" for "date". */
  slots: Record<string, string>
  /** The parts of the home, each with how to present its controls, all in the order to show them. */
  groups: { title: string; controls: { intent: string; title: string; description: string; answers?: string }[] }[]
}

/** Where controls go when no group describes them. */
export const UNDESCRIBED_GROUP_TITLE = 'Other'

/**
 * Lists what people can do by talking to the skill, grouped by the part of the home that each control works on.
 *
 * The controls are the intents that have phrases of their own. That leaves out Alexa's built-in intents, such as
 * "stop", which work the same way in every skill. The descriptions decide the groups and the order of everything
 * in them. An intent that hasn't been described is still listed, in a last group of its own and under a name worked
 * out from the intent's, so that a control is never hidden by a missing description. A description of an intent
 * that the model doesn't have is ignored.
 *
 * @param model The skill's interaction model.
 * @param descriptions The skill's descriptions of its controls.
 * @returns The groups that have at least one control.
 */
export function listAlexaControlGroups(model: InteractionModel, descriptions: ControlDescriptions): AlexaControlGroup[] {
  const sayableIntents = model.interactionModel.languageModel.intents.filter((intent) => (intent.samples ?? []).length > 0)
  const phrasesByIntent = new Map(
    sayableIntents.map((intent) => [intent.name, (intent.samples ?? []).map((sample) => splitIntoParts(sample, descriptions.slots))]),
  )

  const describedGroups = descriptions.groups.map((group) => ({
    title: group.title,
    controls: group.controls.flatMap(({ intent, title, description, answers }) => {
      const phrases = phrasesByIntent.get(intent)
      return phrases === undefined ? [] : [{ intent, title, description, answers: answers ?? null, phrases }]
    }),
  }))

  const describedIntents = new Set(descriptions.groups.flatMap((group) => group.controls.map((control) => control.intent)))
  const undescribedControls = sayableIntents
    .filter((intent) => !describedIntents.has(intent.name))
    .map((intent) => ({
      intent: intent.name,
      title: describeIntentName(intent.name),
      description: null,
      answers: null,
      phrases: phrasesByIntent.get(intent.name) ?? [],
    }))

  return [...describedGroups, { title: UNDESCRIBED_GROUP_TITLE, controls: undescribedControls }].filter((group) => group.controls.length > 0)
}

/** Turns "AddReminderIntent" into "Add reminder". */
function describeIntentName(intentName: string): string {
  const words = intentName
    .replace(/Intent$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Splits a sample such as "{date} at {time}" into its words and its slots, which the model writes in braces. */
function splitIntoParts(sample: string, slotDescriptions: Record<string, string>): PhrasePart[] {
  return sample
    .split(/(\{[^}]+\})/)
    .filter((piece) => piece !== '')
    .map((piece) => {
      const slotName = /^\{(.+)\}$/.exec(piece)?.[1]
      return slotName === undefined ? { text: piece, isStandIn: false } : { text: slotDescriptions[slotName] ?? slotName, isStandIn: true }
    })
}
