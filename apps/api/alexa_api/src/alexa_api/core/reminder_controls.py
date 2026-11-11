from collections.abc import Callable
from dataclasses import replace
from datetime import datetime
from zoneinfo import ZoneInfo

from alexa_api.core.due_time import describe_due_time, describe_time_of_day, resolve_due_time
from alexa_api.core.reminder import Reminder
from alexa_api.core.reminders_client import RemindersClient
from alexa_api.core.skill_reply import QUESTION_MEMORY_KEY, SkillReply, ask
from alexa_api.core.skill_request import SkillRequest
from alexa_api.core.spoken_match import find_spoken_match

# What the skill remembers while it waits for an answer. At most one of these is remembered at a time, and which one
# it is says what the answer is for.
_NEW_TITLE_MEMORY_KEY = "new_reminder_title"
_RESCHEDULED_ID_MEMORY_KEY = "rescheduled_reminder_id"
_DELETED_ID_MEMORY_KEY = "deleted_reminder_id"

_WAYS_TO_ANSWER_DUE_TIME = "You can say a day, a time, or no time."
_HOW_TO_START_REMINDER = "Say, remind me to, and then the reminder."


class ReminderControls:
    """ What the skill can do with the reminders that the home's site shows: add, read out, tick off, move and delete.

    Several of these are short conversations, because Alexa can't pick both free text and a time out of one
    sentence, and because deleting is worth checking first. The person says what they want, the skill asks a
    question, and the person's answer finishes the job.

    Attributes:
        responders:
            What to call for each intent that this handles, by the intent's name in the skill's interaction model.
            Each takes the request and gives the reply, and may raise `HomeApiUnavailableError`.
    """

    def __init__(self, reminders_client: RemindersClient, home_time_zone: ZoneInfo) -> None:
        """ Creates the controls.

        Args:
            reminders_client:
                The reminders to work on.
            home_time_zone:
                The time zone that people mean when they say a day or a time, and that times are read out in.
        """
        self._reminders_client = reminders_client
        self._home_time_zone = home_time_zone
        self.responders: dict[str, Callable[[SkillRequest], SkillReply]] = {
            "AddReminderIntent": self._start_reminder,
            "ListRemindersIntent": self._list_reminders_due_today,
            "CompleteReminderIntent": self._complete_reminder,
            "ChangeDueTimeIntent": self._start_due_time_change,
            "DeleteReminderIntent": self._start_deletion,
            "SetDueTimeIntent": self._answer_with_due_time,
            "NoDueTimeIntent": self._answer_without_due_time,
            "AMAZON.YesIntent": self._answer_yes,
            "AMAZON.NoIntent": self._answer_no,
        }

    def _start_reminder(self, request: SkillRequest) -> SkillReply:
        title = request.slots.get("title", "").strip()
        if not title:
            return SkillReply(f"What should I remind you about? {_HOW_TO_START_REMINDER}", reprompt=_HOW_TO_START_REMINDER)

        # Alexa gives what it heard in lower case, which looks out of place next to reminders typed on the site.
        title = title[0].upper() + title[1:]
        return ask(f"When is it due? {_WAYS_TO_ANSWER_DUE_TIME}", {_NEW_TITLE_MEMORY_KEY: title})

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

    def _complete_reminder(self, request: SkillRequest) -> SkillReply:
        reminder = self._find_spoken_reminder(request)
        if reminder is None:
            return self._say_reminder_was_not_found(request)

        self._reminders_client.save_reminder(replace(reminder, completed_at=request.received_at))
        return SkillReply(f"I've ticked off {reminder.title}.")

    def _start_due_time_change(self, request: SkillRequest) -> SkillReply:
        reminder = self._find_spoken_reminder(request)
        if reminder is None:
            return self._say_reminder_was_not_found(request)

        question = f"When is {reminder.title} due? {_WAYS_TO_ANSWER_DUE_TIME}"
        return ask(question, {_RESCHEDULED_ID_MEMORY_KEY: reminder.id})

    def _start_deletion(self, request: SkillRequest) -> SkillReply:
        reminder = self._find_spoken_reminder(request)
        if reminder is None:
            return self._say_reminder_was_not_found(request)

        # A deleted reminder can't be brought back, and the title may have been misheard, so the person gets to
        # hear which reminder was found before it goes.
        return ask(f"Delete {reminder.title}?", {_DELETED_ID_MEMORY_KEY: reminder.id})

    def _answer_with_due_time(self, request: SkillRequest) -> SkillReply:
        memory = request.conversation_memory
        if _NEW_TITLE_MEMORY_KEY not in memory and _RESCHEDULED_ID_MEMORY_KEY not in memory:
            return SkillReply(f"First tell me what the reminder is. {_HOW_TO_START_REMINDER}", reprompt=_HOW_TO_START_REMINDER)

        now = self._convert_to_home_time(request.received_at)
        due_at = resolve_due_time(request.slots.get("date"), request.slots.get("time"), now)
        if due_at is None:
            return ask(memory[QUESTION_MEMORY_KEY], memory, preamble="Sorry, I didn't catch when. ")

        if _NEW_TITLE_MEMORY_KEY in memory:
            self._reminders_client.add_reminder(memory[_NEW_TITLE_MEMORY_KEY], due_at)
            return SkillReply(f"I've added {memory[_NEW_TITLE_MEMORY_KEY]}, due {describe_due_time(due_at, now)}.")
        return self._change_due_time(memory[_RESCHEDULED_ID_MEMORY_KEY], due_at, now)

    def _answer_without_due_time(self, request: SkillRequest) -> SkillReply:
        memory = request.conversation_memory
        if _NEW_TITLE_MEMORY_KEY in memory:
            self._reminders_client.add_reminder(memory[_NEW_TITLE_MEMORY_KEY], due_at=None)
            return SkillReply(f"I've added {memory[_NEW_TITLE_MEMORY_KEY]}.")
        if _RESCHEDULED_ID_MEMORY_KEY in memory:
            now = self._convert_to_home_time(request.received_at)
            return self._change_due_time(memory[_RESCHEDULED_ID_MEMORY_KEY], None, now)
        return SkillReply("OK.")

    def _answer_yes(self, request: SkillRequest) -> SkillReply:
        memory = request.conversation_memory
        if _DELETED_ID_MEMORY_KEY not in memory:
            if QUESTION_MEMORY_KEY in memory:
                # "Yes" doesn't answer any other question, so it is asked again rather than dropped.
                return ask(memory[QUESTION_MEMORY_KEY], memory, preamble="Sorry, I didn't catch that. ")
            return SkillReply("Sorry, I'm not sure what you're saying yes to.")

        reminder = self._find_reminder_by_id(memory[_DELETED_ID_MEMORY_KEY])
        if reminder is None:
            return SkillReply("That reminder has already gone.")
        self._reminders_client.delete_reminder(reminder)
        return SkillReply(f"I've deleted {reminder.title}.")

    def _answer_no(self, request: SkillRequest) -> SkillReply:
        if _DELETED_ID_MEMORY_KEY in request.conversation_memory:
            return SkillReply("OK, I've kept it.")
        # To "When is it due?", a plain "no" means that there is no due time.
        return self._answer_without_due_time(request)

    def _change_due_time(self, reminder_id: str, due_at: datetime | None, now: datetime) -> SkillReply:
        reminder = self._find_reminder_by_id(reminder_id)
        if reminder is None:
            return SkillReply("That reminder has already gone.")

        self._reminders_client.save_reminder(replace(reminder, due_at=due_at))
        if due_at is None:
            return SkillReply(f"{reminder.title} no longer has a due time.")
        return SkillReply(f"{reminder.title} is now due {describe_due_time(due_at, now)}.")

    def _find_spoken_reminder(self, request: SkillRequest) -> Reminder | None:
        reminders = self._reminders_client.list_unfinished_reminders()
        return find_spoken_match(request.slots.get("title", ""), reminders, lambda reminder: reminder.title)

    def _find_reminder_by_id(self, reminder_id: str) -> Reminder | None:
        # The reminder is fetched again, rather than remembered whole, because it may have been changed on the site
        # while the skill waited for an answer.
        reminders = self._reminders_client.list_unfinished_reminders()
        return next((reminder for reminder in reminders if reminder.id == reminder_id), None)

    def _say_reminder_was_not_found(self, request: SkillRequest) -> SkillReply:
        spoken_title = request.slots.get("title", "").strip()
        if not spoken_title:
            return SkillReply("Sorry, I didn't catch which reminder you meant.")
        return SkillReply(f"I couldn't find an unfinished reminder like {spoken_title}.")

    def _convert_to_home_time(self, moment: datetime) -> datetime:
        return moment.astimezone(self._home_time_zone)
