from collections.abc import Callable

from alexa_api.core.home_api import HomeApiUnavailableError
from alexa_api.core.reminder_controls import ReminderControls
from alexa_api.core.site_editor_controls import SiteEditorControls
from alexa_api.core.skill_reply import QUESTION_MEMORY_KEY, SkillReply, ask
from alexa_api.core.skill_request import SkillRequest
from alexa_api.core.timer_controls import TimerControls

_GREETING = "I'm listening."
_HELP = "The Alexa controls page on the site lists everything you can say."


class HomeHubSkill:
    """ The home's Alexa skill: decides what to do, and what to say, for each thing a person says to it.

    The skill's interaction model (`skill/skill-package/interactionModels`) defines what people can say and the
    intent that each phrase becomes. Every intent there needs a responder, which belongs with the controls for the
    part of the home that it works on. An intent without one gets a spoken apology, so a phrase can be added to
    the model before the skill can act on it. The site's Alexa controls page lists every intent with its phrases,
    and explains each one using `skill/control-descriptions.json`.
    """

    def __init__(
            self,
            reminder_controls: ReminderControls,
            timer_controls: TimerControls,
            site_editor_controls: SiteEditorControls,
    ) -> None:
        """ Creates the skill from the controls for each part of the home.

        Args:
            reminder_controls:
                Handles what people say about reminders.
            timer_controls:
                Handles what people say about the timer.
            site_editor_controls:
                Handles what people say about changing the site.
        """
        self._responders: dict[str, Callable[[SkillRequest], SkillReply]] = {
            "LaunchRequest": self._greet,
            "AMAZON.HelpIntent": self._offer_help,
            "AMAZON.StopIntent": self._end_conversation,
            "AMAZON.CancelIntent": self._end_conversation,
            "AMAZON.NavigateHomeIntent": self._end_conversation,
            "SessionEndedRequest": self._stay_silent,
            **reminder_controls.responders,
            **timer_controls.responders,
            **site_editor_controls.responders,
        }

    def respond(self, request: SkillRequest) -> SkillReply:
        """ Does what a person asked for, and decides what to say back.

        Never raises for something a person can cause: a request that isn't understood, or that can't be carried out
        because one of the home's APIs is unavailable, gets a reply that says so.

        Args:
            request:
                What the person said.

        Returns:
            What Alexa says back, and whether the conversation carries on.
        """
        respond = self._responders.get(request.name, self._apologise_for_not_understanding)
        try:
            return respond(request)
        except HomeApiUnavailableError as error:
            # Nothing the skill does is worth retrying while the person waits, so every action fails the same way:
            # by telling them. They can ask again once the API is back.
            return SkillReply(f"Sorry, I couldn't reach the {error.spoken_name}. Please try again later.")

    def _greet(self, request: SkillRequest) -> SkillReply:
        return SkillReply(_GREETING, reprompt=_GREETING)

    def _offer_help(self, request: SkillRequest) -> SkillReply:
        return SkillReply(_HELP, reprompt=_HELP)

    def _end_conversation(self, request: SkillRequest) -> SkillReply:
        return SkillReply("OK.")

    def _stay_silent(self, request: SkillRequest) -> SkillReply:
        # The conversation is already over, so Alexa wouldn't say anything that was sent back.
        return SkillReply(speech=None)

    def _apologise_for_not_understanding(self, request: SkillRequest) -> SkillReply:
        unanswered_question = request.conversation_memory.get(QUESTION_MEMORY_KEY)
        if unanswered_question is not None:
            # A misheard answer shouldn't throw away what the person has already said, so the question is asked
            # again with everything that was remembered for it.
            return ask(unanswered_question, request.conversation_memory, preamble="Sorry, I didn't catch that. ")
        return SkillReply("Sorry, I can't do that yet.")
