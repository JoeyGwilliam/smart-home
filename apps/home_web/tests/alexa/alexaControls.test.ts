import { listAlexaControls, type ControlDescriptions, type InteractionModel } from '@/alexa/alexaControls'

function createModel(intents: { name: string; samples?: string[] }[]): InteractionModel {
  return { interactionModel: { languageModel: { invocationName: 'home hub', intents } } }
}

test('presents a control with its description when the intent is described', () => {
  const model = createModel([{ name: 'SetDueTimeIntent', samples: ['tomorrow'] }])
  const descriptions: ControlDescriptions = {
    slots: {},
    controls: {
      SetDueTimeIntent: { title: 'Give the due time', description: 'Adds the reminder.', answers: 'When is it due?' },
    },
  }

  const controls = listAlexaControls(model, descriptions)

  expect(controls).toEqual([
    {
      intent: 'SetDueTimeIntent',
      title: 'Give the due time',
      description: 'Adds the reminder.',
      answers: 'When is it due?',
      phrases: [[{ text: 'tomorrow', isStandIn: false }]],
    },
  ])
})

test('presents a control as one that can be used at any time when its description names no question', () => {
  const model = createModel([{ name: 'ListRemindersIntent', samples: ["what's due today"] }])
  const descriptions: ControlDescriptions = {
    slots: {},
    controls: { ListRemindersIntent: { title: "Hear what's due", description: 'Reads out reminders.' } },
  }

  const [control] = listAlexaControls(model, descriptions)

  expect(control.answers).toBeNull()
})

test('names a control after its intent when the intent is not described', () => {
  const model = createModel([{ name: 'TurnOffLightsIntent', samples: ['turn off the lights'] }])
  const descriptions: ControlDescriptions = { slots: {}, controls: {} }

  const [control] = listAlexaControls(model, descriptions)

  expect(control.title).toBe('Turn off lights')
  expect(control.description).toBeNull()
  expect(control.answers).toBeNull()
})

test('splits a phrase into words and described stand-ins when the sample has slots', () => {
  const model = createModel([{ name: 'SetDueTimeIntent', samples: ['on {date} at {time}'] }])
  const descriptions: ControlDescriptions = { slots: { date: 'a day', time: 'a time' }, controls: {} }

  const [control] = listAlexaControls(model, descriptions)

  expect(control.phrases).toEqual([
    [
      { text: 'on ', isStandIn: false },
      { text: 'a day', isStandIn: true },
      { text: ' at ', isStandIn: false },
      { text: 'a time', isStandIn: true },
    ],
  ])
})

test('uses the slot name as the stand-in when the slot is not described', () => {
  const model = createModel([{ name: 'AddReminderIntent', samples: ['remind me to {title}'] }])
  const descriptions: ControlDescriptions = { slots: {}, controls: {} }

  const [control] = listAlexaControls(model, descriptions)

  expect(control.phrases).toEqual([
    [
      { text: 'remind me to ', isStandIn: false },
      { text: 'title', isStandIn: true },
    ],
  ])
})

test('leaves out an intent when it has no phrases of its own', () => {
  const model = createModel([
    { name: 'AMAZON.StopIntent', samples: [] },
    { name: 'AMAZON.HelpIntent' },
    { name: 'ListRemindersIntent', samples: ["what's due today"] },
  ])
  const descriptions: ControlDescriptions = { slots: {}, controls: {} }

  const controls = listAlexaControls(model, descriptions)

  expect(controls.map((control) => control.intent)).toEqual(['ListRemindersIntent'])
})

test('keeps the order of the interaction model when listing several controls', () => {
  const model = createModel([
    { name: 'SecondAlphabeticallyIntent', samples: ['one'] },
    { name: 'FirstAlphabeticallyIntent', samples: ['two'] },
  ])
  const descriptions: ControlDescriptions = { slots: {}, controls: {} }

  const controls = listAlexaControls(model, descriptions)

  expect(controls.map((control) => control.intent)).toEqual(['SecondAlphabeticallyIntent', 'FirstAlphabeticallyIntent'])
})
