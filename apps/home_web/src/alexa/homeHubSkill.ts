// The skill's own files are read when the site is built, so this page can never describe anything but the skill in
// the same commit. They live with the skill (apps/api/alexa_api/skill), which vite.config.ts and the Dockerfile make
// reachable as @alexa-skill.
import controlDescriptions from '@alexa-skill/control-descriptions.json'
import interactionModel from '@alexa-skill/skill-package/interactionModels/custom/en-GB.json'

import { listAlexaControls, type AlexaControl } from '@/alexa/alexaControls'

/** What people call the skill when they talk to Alexa, as in "Alexa, ask home hub…". */
export const HOME_HUB_INVOCATION_NAME: string = interactionModel.interactionModel.languageModel.invocationName

/** Everything that people can do by talking to the home's Alexa skill. */
export const HOME_HUB_CONTROLS: AlexaControl[] = listAlexaControls(interactionModel, controlDescriptions)
