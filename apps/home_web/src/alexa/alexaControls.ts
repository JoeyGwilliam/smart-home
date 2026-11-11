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
  /** How to present each control, by intent name. */
  controls: Record<string, { title: string; description: string; answers?: string }>
}

/**
 * Lists what people can do by talking to the skill, in the interaction model's order.
 *
 * The controls are the intents that have phrases of their own. That leaves out Alexa's built-in intents, such as
 * "stop", which work the same way in every skill. An intent or a slot that hasn't been described is still listed,
 * under a name worked out from its own, so that a control is never hidden by a missing description.
 *
 * @param model The skill's interaction model.
 * @param descriptions The skill's descriptions of its controls.
 * @returns The controls.
 */
export function listAlexaControls(model: InteractionModel, descriptions: ControlDescriptions): AlexaControl[] {
  return model.interactionModel.languageModel.intents
    .filter((intent) => intent.samples !== undefined && intent.samples.length > 0)
    .map((intent) => {
      const controlDescription = descriptions.controls[intent.name]
      return {
        intent: intent.name,
        title: controlDescription?.title ?? describeIntentName(intent.name),
        description: controlDescription?.description ?? null,
        answers: controlDescription?.answers ?? null,
        phrases: (intent.samples ?? []).map((sample) => splitIntoParts(sample, descriptions.slots)),
      }
    })
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
