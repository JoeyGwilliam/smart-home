import controlDescriptions from '@alexa-skill/control-descriptions.json'

import { HOME_HUB_CONTROLS, HOME_HUB_INVOCATION_NAME } from '@/alexa/homeHubSkill'

// These check the skill's real files, so they fail when an intent is added to the interaction model without a
// description in control-descriptions.json. Fix that by describing the intent there.

test('has a description for every control when reading the real skill', () => {
  const undescribedIntents = HOME_HUB_CONTROLS.filter((control) => control.description === null).map((control) => control.intent)

  expect(undescribedIntents).toEqual([])
})

test('has a control for every description when reading the real skill', () => {
  const intentsWithControls = HOME_HUB_CONTROLS.map((control) => control.intent)

  const descriptionsWithoutControls = Object.keys(controlDescriptions.controls).filter((intent) => !intentsWithControls.includes(intent))

  expect(descriptionsWithoutControls).toEqual([])
})

test('has a description for every stand-in when reading the real skill', () => {
  const describedStandIns = Object.values(controlDescriptions.slots)

  const standIns = HOME_HUB_CONTROLS.flatMap((control) => control.phrases.flat())
    .filter((part) => part.isStandIn)
    .map((part) => part.text)

  expect(standIns.filter((standIn) => !describedStandIns.includes(standIn))).toEqual([])
})

test('has an invocation name when reading the real skill', () => {
  expect(HOME_HUB_INVOCATION_NAME).not.toBe('')
})
