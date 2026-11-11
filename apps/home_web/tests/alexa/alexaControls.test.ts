import { listAlexaControlGroups, type ControlDescriptions, type InteractionModel } from '@/alexa/alexaControls'

function createModel(intents: { name: string; samples?: string[] }[]): InteractionModel {
  return { interactionModel: { languageModel: { invocationName: 'home hub', intents } } }
}

test('presents a control in its group with its description when the intent is described', () => {
  const model = createModel([{ name: 'SetDueTimeIntent', samples: ['tomorrow'] }])
  const descriptions: ControlDescriptions = {
    slots: {},
    groups: [
      {
        title: 'Reminders',
        controls: [{ intent: 'SetDueTimeIntent', title: 'Give the due time', description: 'Adds the reminder.', answers: 'When is it due?' }],
      },
    ],
  }

  const groups = listAlexaControlGroups(model, descriptions)

  expect(groups).toEqual([
    {
      title: 'Reminders',
      controls: [
        {
          intent: 'SetDueTimeIntent',
          title: 'Give the due time',
          description: 'Adds the reminder.',
          answers: 'When is it due?',
          phrases: [[{ text: 'tomorrow', isStandIn: false }]],
        },
      ],
    },
  ])
})

test('presents a control as one that can be used at any time when its description names no question', () => {
  const model = createModel([{ name: 'ListRemindersIntent', samples: ["what's due today"] }])
  const descriptions: ControlDescriptions = {
    slots: {},
    groups: [{ title: 'Reminders', controls: [{ intent: 'ListRemindersIntent', title: 'Check reminders', description: 'Reads them out.' }] }],
  }

  const [group] = listAlexaControlGroups(model, descriptions)

  expect(group.controls[0].answers).toBeNull()
})

test('orders groups and their controls as the descriptions do when the model orders them differently', () => {
  const model = createModel([
    { name: 'StopTimerIntent', samples: ['stop the timer'] },
    { name: 'ListRemindersIntent', samples: ["what's due today"] },
    { name: 'AddReminderIntent', samples: ['remind me to {title}'] },
  ])
  const descriptions: ControlDescriptions = {
    slots: {},
    groups: [
      {
        title: 'Reminders',
        controls: [
          { intent: 'AddReminderIntent', title: 'Add a reminder', description: 'Adds one.' },
          { intent: 'ListRemindersIntent', title: 'Check reminders', description: 'Reads them out.' },
        ],
      },
      { title: 'Timers', controls: [{ intent: 'StopTimerIntent', title: 'Stop the timer', description: 'Stops it.' }] },
    ],
  }

  const groups = listAlexaControlGroups(model, descriptions)

  expect(groups.map((group) => [group.title, group.controls.map((control) => control.title)])).toEqual([
    ['Reminders', ['Add a reminder', 'Check reminders']],
    ['Timers', ['Stop the timer']],
  ])
})

test('lists a control last, in a group called Other and named after its intent, when the intent is not described', () => {
  const model = createModel([
    { name: 'TurnOffLightsIntent', samples: ['turn off the lights'] },
    { name: 'ListRemindersIntent', samples: ["what's due today"] },
  ])
  const descriptions: ControlDescriptions = {
    slots: {},
    groups: [{ title: 'Reminders', controls: [{ intent: 'ListRemindersIntent', title: 'Check reminders', description: 'Reads them out.' }] }],
  }

  const groups = listAlexaControlGroups(model, descriptions)

  expect(groups.map((group) => group.title)).toEqual(['Reminders', 'Other'])
  expect(groups[1].controls).toEqual([
    {
      intent: 'TurnOffLightsIntent',
      title: 'Turn off lights',
      description: null,
      answers: null,
      phrases: [[{ text: 'turn off the lights', isStandIn: false }]],
    },
  ])
})

test('splits a phrase into words and described stand-ins when the sample has slots', () => {
  const model = createModel([{ name: 'SetDueTimeIntent', samples: ['on {date} at {time}'] }])
  const descriptions: ControlDescriptions = { slots: { date: 'a day', time: 'a time' }, groups: [] }

  const [group] = listAlexaControlGroups(model, descriptions)

  expect(group.controls[0].phrases).toEqual([
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
  const descriptions: ControlDescriptions = { slots: {}, groups: [] }

  const [group] = listAlexaControlGroups(model, descriptions)

  expect(group.controls[0].phrases).toEqual([
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
  const descriptions: ControlDescriptions = { slots: {}, groups: [] }

  const groups = listAlexaControlGroups(model, descriptions)

  expect(groups.flatMap((group) => group.controls.map((control) => control.intent))).toEqual(['ListRemindersIntent'])
})

test('leaves out a description when the model has no such intent', () => {
  const model = createModel([{ name: 'ListRemindersIntent', samples: ["what's due today"] }])
  const descriptions: ControlDescriptions = {
    slots: {},
    groups: [
      {
        title: 'Reminders',
        controls: [
          { intent: 'RemovedIntent', title: 'Removed', description: 'No longer in the model.' },
          { intent: 'ListRemindersIntent', title: 'Check reminders', description: 'Reads them out.' },
        ],
      },
    ],
  }

  const [group] = listAlexaControlGroups(model, descriptions)

  expect(group.controls.map((control) => control.intent)).toEqual(['ListRemindersIntent'])
})

test('leaves out a group when none of its intents are in the model', () => {
  const model = createModel([{ name: 'ListRemindersIntent', samples: ["what's due today"] }])
  const descriptions: ControlDescriptions = {
    slots: {},
    groups: [
      { title: 'Lights', controls: [{ intent: 'TurnOffLightsIntent', title: 'Turn off the lights', description: 'Not built yet.' }] },
      { title: 'Reminders', controls: [{ intent: 'ListRemindersIntent', title: 'Check reminders', description: 'Reads them out.' }] },
    ],
  }

  const groups = listAlexaControlGroups(model, descriptions)

  expect(groups.map((group) => group.title)).toEqual(['Reminders'])
})
