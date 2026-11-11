import { HOME_HUB_CONTROL_GROUPS, HOME_HUB_INVOCATION_NAME } from '@/alexa/homeHubSkill'
import { AlexaControlList } from '@/pages/alexaControls/AlexaControlList'

/** Everything that can be said to the home's Alexa skill. It is built from the skill's own files, so it keeps up with them. */
export function AlexaControlsPage() {
  return <AlexaControlList invocationName={HOME_HUB_INVOCATION_NAME} groups={HOME_HUB_CONTROL_GROUPS} />
}
