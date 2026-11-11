from collections.abc import Callable

from alexa_api.core.site_editor_client import SiteEditorBusyError, SiteEditorClient
from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest

# What to say for each state that the site editor API can report.
_STATE_DESCRIPTIONS = {
    "idle": "No change is being made to the site.",
    "working": "Claude is still working on the change.",
    "building": "The site is being rebuilt.",
    "discussing": "Claude has answered. Look at the site editor page to read what it said.",
    "reviewing": "The change is ready to look at. You can confirm or discard it on the site editor page.",
    "saving": "The change is being saved.",
}


class SiteEditorControls:
    """ What the skill can do with the site editor: ask for a change to the site, and hear how the change is going.

    A change that was asked for by voice is only started. Confirming it is deliberately left to the site editor
    page, where the person can see the change before it is saved.

    Attributes:
        responders:
            What to call for each intent that this handles, by the intent's name in the skill's interaction model.
            Each takes the request and gives the reply, and may raise `HomeApiUnavailableError`.
    """

    def __init__(self, site_editor_client: SiteEditorClient) -> None:
        """ Creates the controls.

        Args:
            site_editor_client:
                The site editor to work with.
        """
        self._site_editor_client = site_editor_client
        self.responders: dict[str, Callable[[SkillRequest], SkillReply]] = {
            "RequestSiteChangeIntent": self._request_change,
            "SiteChangeProgressIntent": self._describe_progress,
        }

    def _request_change(self, request: SkillRequest) -> SkillReply:
        spoken_request = request.slots.get("request", "").strip()
        if not spoken_request:
            return SkillReply("Sorry, I didn't catch what you want changed.")

        try:
            self._site_editor_client.request_change(spoken_request[0].upper() + spoken_request[1:])
        except SiteEditorBusyError:
            # The person can do nothing about this by voice except wait, so they are told why and when to try again.
            return SkillReply("The site editor is busy with another change. Try again when it has finished.")
        return SkillReply("I've passed that to the site editor. Look at the site editor page to see the change and confirm it.")

    def _describe_progress(self, request: SkillRequest) -> SkillReply:
        state = self._site_editor_client.get_change_state()
        return SkillReply(_STATE_DESCRIPTIONS.get(state, f"The site editor is {state}."))
