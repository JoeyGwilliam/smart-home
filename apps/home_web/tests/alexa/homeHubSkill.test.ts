import controlDescriptions from '@alexa-skill/control-descriptions.json'
import interactionModel from '@alexa-skill/skill-package/interactionModels/custom/en-GB.json'

import { UNDESCRIBED_GROUP_TITLE } from '@/alexa/alexaControls'
import { HOME_HUB_CONTROL_GROUPS, HOME_HUB_INVOCATION_NAME } from '@/alexa/homeHubSkill'

// These check the skill's real files, so they fail when the interaction model and control-descriptions.json fall out
// of step. Fix that in control-descriptions.json: describe the new intent or slot, or remove what is no longer there.

test('has a description for every control when reading the real skill', () => {
  const undescribedGroup = HOME_HUB_CONTROL_GROUPS.find((group) => group.title === UNDESCRIBED_GROUP_TITLE)

  const undescribedIntents = (undescribedGroup?.controls ?? []).map((control) => control.intent)

  expect(undescribedIntents).toEqual([])
})

test('has a control for every description when reading the real skill', () => {
  const describedIntents = controlDescriptions.groups.flatMap((group) => group.controls.map((control) => control.intent))

  const intentsInModel = interactionModel.interactionModel.languageModel.intents.map((intent) => intent.name)

  expect(describedIntents.filter((intent) => !intentsInModel.includes(intent))).toEqual([])
})

test('has a description for every stand-in when reading the real skill', () => {
  const describedStandIns = Object.values(controlDescriptions.slots)

  const standIns = HOME_HUB_CONTROL_GROUPS.flatMap((group) => group.controls)
    .flatMap((control) => control.phrases.flat())
    .filter((part) => part.isStandIn)
    .map((part) => part.text)

  expect(standIns.filter((standIn) => !describedStandIns.includes(standIn))).toEqual([])
})

test('has an invocation name when reading the real skill', () => {
  expect(HOME_HUB_INVOCATION_NAME).not.toBe('')
})
