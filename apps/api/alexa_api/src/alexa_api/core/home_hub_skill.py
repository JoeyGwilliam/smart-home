from dataclasses import replace
from datetime import datetime
from zoneinfo import ZoneInfo

from alexa_api.core.due_time import describe_due_time, describe_time_of_day, resolve_due_time
from alexa_api.core.reminders_client import RemindersClient, RemindersUnavailableError
from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest

# Holds the title of a reminder while the skill waits to hear when it is due.
_TITLE_MEMORY_KEY = "reminder_title"

_DUE_TIME_QUESTION = "When is it due? You can say a day, a time, or no time."
_HELP = "You can say, remind me to water the plants. Or ask, what's due today."


class HomeHubSkill:
    """ The home's Alexa skill: decides what to do, and what to say, for each thing a person says to it.

    The skill's interaction model (`skill/skill-package/interactionModels`) defines what people can say and the
    intent that each phrase becomes. Every intent there needs to be handled here; one that isn't gets a spoken
    apology, so a phrase can be added to the model before the skill can act on it. The site's Alexa controls page
    lists every intent with its phrases, and explains each one using `skill/control-descriptions.json`.

    Adding a reminder is a short conversation, because Alexa can't pick both free text and a time out of one
    sentence: the person says what the reminder is, the skill asks when it is due, and the person answers.
    """

    def __init__(self, reminders_client: RemindersClient, home_time_zone: ZoneInfo) -> None:
        """ Creates the skill.

        Args:
            reminders_client:
                The reminders that the skill adds to and reads out.
            home_time_zone:
                The time zone that people mean when they say a day or a time, and that times are read out in.
        """
        self._reminders_client = reminders_client
        self._home_time_zone = home_time_zone
        self._responders = {
            "LaunchRequest": self._offer_help,
            "AMAZON.HelpIntent": self._offer_help,
            "AddReminderIntent": self._start_reminder,
            "SetDueTimeIntent": self._add_reminder_with_due_time,
            "NoDueTimeIntent": self._add_reminder_without_due_time,
            "AMAZON.NoIntent": self._add_reminder_without_due_time,
            "ListRemindersIntent": self._list_reminders_due_today,
            "AMAZON.StopIntent": self._end_conversation,
            "AMAZON.CancelIntent": self._end_conversation,
            "AMAZON.NavigateHomeIntent": self._end_conversation,
            "SessionEndedRequest": self._stay_silent,
        }

    def respond(self, request: SkillRequest) -> SkillReply:
        """ Does what a person asked for, and decides what to say back.

        Never raises for something a person can cause: a request that isn't understood, or that can't be carried out
        because the reminders API is unavailable, gets a reply that says so.

        Args:
            request:
                What the person said.

        Returns:
            What Alexa says back, and whether the conversation carries on.
        """
        respond = self._responders.get(request.name, self._apologise_for_not_understanding)
        try:
            return respond(request)
        except RemindersUnavailableError:
            # Nothing the skill does is worth retrying while the person waits, so every action fails the same way:
            # by telling them. They can ask again once the reminders API is back.
            return SkillReply("Sorry, I couldn't reach your reminders. Please try again later.")

    def _offer_help(self, request: SkillRequest) -> SkillReply:
        return SkillReply(_HELP, reprompt=_HELP)

    def _start_reminder(self, request: SkillRequest) -> SkillReply:
        title = request.slots.get("title", "").strip()
        if not title:
            return SkillReply("What should I remind you about? Say, remind me to, and then the reminder.", reprompt=_HELP)

        # Alexa gives what it heard in lower case, which looks out of place next to reminders typed on the site.
        title = title[0].upper() + title[1:]
        return SkillReply(_DUE_TIME_QUESTION, reprompt=_DUE_TIME_QUESTION, conversation_memory={_TITLE_MEMORY_KEY: title})

    def _add_reminder_with_due_time(self, request: SkillRequest) -> SkillReply:
        title = request.conversation_memory.get(_TITLE_MEMORY_KEY)
        if title is None:
            return SkillReply("First tell me what the reminder is. Say, remind me to, and then the reminder.", reprompt=_HELP)

        now = self._convert_to_home_time(request.received_at)
        due_at = resolve_due_time(request.slots.get("date"), request.slots.get("time"), now)
        if due_at is None:
            return SkillReply(
                f"Sorry, I didn't catch when. {_DUE_TIME_QUESTION}",
                reprompt=_DUE_TIME_QUESTION,
                conversation_memory=request.conversation_memory,
            )

        self._reminders_client.add_reminder(title, due_at)
        return SkillReply(f"I've added {title}, due {describe_due_time(due_at, now)}.")

    def _add_reminder_without_due_time(self, request: SkillRequest) -> SkillReply:
        title = request.conversation_memory.get(_TITLE_MEMORY_KEY)
        if title is None:
            return self._end_conversation(request)

        self._reminders_client.add_reminder(title, due_at=None)
        return SkillReply(f"I've added {title}.")

    def _list_reminders_due_today(self, request: SkillRequest) -> SkillReply:
        now = self._convert_to_home_time(request.received_at)
        reminders_in_home_time = [
            replace(reminder, due_at=self._convert_to_home_time(reminder.due_at))
            for reminder in self._reminders_client.list_unfinished_reminders()
            if reminder.due_at is not None
        ]
        # Overdue reminders still need doing today, so they are read out too.
        reminders_due = sorted(
            (reminder for reminder in reminders_in_home_time if reminder.due_at.date() <= now.date()),
            key=lambda reminder: reminder.due_at,
        )
        if not reminders_due:
            return SkillReply("Nothing is due today.")

        descriptions = [
            f"{reminder.title}, at {describe_time_of_day(reminder.due_at)}" if reminder.due_at.date() == now.date()
            else f"{reminder.title}, due {describe_due_time(reminder.due_at, now)}"
            for reminder in reminders_due
        ]
        count = "1 reminder" if len(descriptions) == 1 else f"{len(descriptions)} reminders"
        return SkillReply(f"You have {count} due. {'. '.join(descriptions)}.")

    def _end_conversation(self, request: SkillRequest) -> SkillReply:
        return SkillReply("OK.")

    def _stay_silent(self, request: SkillRequest) -> SkillReply:
        # The conversation is already over, so Alexa wouldn't say anything that was sent back.
        return SkillReply(speech=None)

    def _apologise_for_not_understanding(self, request: SkillRequest) -> SkillReply:
        if _TITLE_MEMORY_KEY in request.conversation_memory:
            # A misheard answer shouldn't throw away the reminder that the person has already described.
            return SkillReply(
                f"Sorry, I didn't catch that. {_DUE_TIME_QUESTION}",
                reprompt=_DUE_TIME_QUESTION,
                conversation_memory=request.conversation_memory,
            )
        return SkillReply("Sorry, I can't do that yet.")

    def _convert_to_home_time(self, moment: datetime) -> datetime:
        return moment.astimezone(self._home_time_zone)
