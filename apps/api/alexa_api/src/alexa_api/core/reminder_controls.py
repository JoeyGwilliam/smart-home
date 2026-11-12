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
from alexa_api.core.spoken_period import SpokenPeriod, describe_day, resolve_spoken_period

# What the skill remembers while it waits for an answer. Which of these is remembered says what the answer is for. A
# new reminder is remembered by its title while its due time is asked, then also by its due time (empty if it has none)
# while the person it is for is asked.
_NEW_TITLE_MEMORY_KEY = "new_reminder_title"
_NEW_DUE_AT_MEMORY_KEY = "new_reminder_due_at"
_RESCHEDULED_ID_MEMORY_KEY = "rescheduled_reminder_id"
_DELETED_ID_MEMORY_KEY = "deleted_reminder_id"

_WAYS_TO_ANSWER_DUE_TIME = "You can say a day, a time, or no time."
_ASSIGNEES = ("Joey", "Georgie")
_WAYS_TO_ANSWER_ASSIGNEE = "You can say Joey, Georgie, or nobody."
_HOW_TO_START_REMINDER = "Say, remind me to, and then the reminder."


class ReminderControls:
    """ What the skill can do with the reminders that the home's site shows: add, read out, tick off, move and delete.

    Adding asks when the reminder is due and then who it is for, which is Joey, Georgie or nobody.

    Reading out covers today unless the person names a day, a weekend or a week, such as tomorrow or this week.

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
            "ListRemindersIntent": self._list_reminders_due,
            "CompleteReminderIntent": self._complete_reminder,
            "ChangeDueTimeIntent": self._start_due_time_change,
            "DeleteReminderIntent": self._start_deletion,
            "SetDueTimeIntent": self._answer_with_due_time,
            "NoDueTimeIntent": self._answer_without_due_time,
            "SetAssigneeIntent": self._answer_with_assignee,
            "NoAssigneeIntent": self._answer_with_nobody,
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

    def _list_reminders_due(self, request: SkillRequest) -> SkillReply:
        now = self._convert_to_home_time(request.received_at)
        today = now.date()
        spoken_period = request.slots.get("period")
        period = SpokenPeriod(today, today) if spoken_period is None else resolve_spoken_period(spoken_period)
        if period is None:
            return SkillReply("Sorry, I can only check what's due on a day, at a weekend or in a week.")

        reminders_in_home_time = [
            replace(reminder, due_at=self._convert_to_home_time(reminder.due_at))
            for reminder in self._reminders_client.list_unfinished_reminders()
            if reminder.due_at is not None
        ]
        # Overdue reminders still need doing, so they are read out too whenever the period includes today.
        reminders_due = sorted(
            (
                reminder for reminder in reminders_in_home_time
                if period.includes(reminder.due_at.date()) or (period.includes(today) and reminder.due_at.date() < today)
            ),
            key=lambda reminder: reminder.due_at,
        )
        if not reminders_due:
            return SkillReply(f"Nothing is due {period.describe(today)}.")

        is_only_today = period == SpokenPeriod(today, today)
        descriptions = [f"{reminder.title}, {_describe_when_due(reminder, now, is_only_today)}" for reminder in reminders_due]
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
            return self._ask_who_new_reminder_is_for(memory[_NEW_TITLE_MEMORY_KEY], due_at)
        return self._change_due_time(memory[_RESCHEDULED_ID_MEMORY_KEY], due_at, now)

    def _answer_without_due_time(self, request: SkillRequest) -> SkillReply:
        memory = request.conversation_memory
        if _NEW_DUE_AT_MEMORY_KEY in memory:
            # "None" or "no", to "Who is it for?", means nobody.
            return self._answer_with_nobody(request)
        if _NEW_TITLE_MEMORY_KEY in memory:
            return self._ask_who_new_reminder_is_for(memory[_NEW_TITLE_MEMORY_KEY], due_at=None)
        if _RESCHEDULED_ID_MEMORY_KEY in memory:
            now = self._convert_to_home_time(request.received_at)
            return self._change_due_time(memory[_RESCHEDULED_ID_MEMORY_KEY], None, now)
        return SkillReply("OK.")

    def _answer_with_assignee(self, request: SkillRequest) -> SkillReply:
        memory = request.conversation_memory
        if _NEW_DUE_AT_MEMORY_KEY not in memory:
            return SkillReply(f"First tell me what the reminder is. {_HOW_TO_START_REMINDER}", reprompt=_HOW_TO_START_REMINDER)

        assignee = _find_assignee(request.slots.get("person", ""))
        if assignee is None:
            return ask(memory[QUESTION_MEMORY_KEY], memory, preamble="Sorry, I didn't catch who. ")
        return self._add_new_reminder(memory, assignee, self._convert_to_home_time(request.received_at))

    def _answer_with_nobody(self, request: SkillRequest) -> SkillReply:
        memory = request.conversation_memory
        if _NEW_DUE_AT_MEMORY_KEY not in memory:
            return SkillReply("OK.")
        return self._add_new_reminder(memory, None, self._convert_to_home_time(request.received_at))

    def _ask_who_new_reminder_is_for(self, title: str, due_at: datetime | None) -> SkillReply:
        memory = {_NEW_TITLE_MEMORY_KEY: title, _NEW_DUE_AT_MEMORY_KEY: "" if due_at is None else due_at.isoformat()}
        return ask(f"Who is it for? {_WAYS_TO_ANSWER_ASSIGNEE}", memory)

    def _add_new_reminder(self, memory: dict[str, str], assignee: str | None, now: datetime) -> SkillReply:
        title = memory[_NEW_TITLE_MEMORY_KEY]
        due_at = datetime.fromisoformat(memory[_NEW_DUE_AT_MEMORY_KEY]) if memory[_NEW_DUE_AT_MEMORY_KEY] else None
        self._reminders_client.add_reminder(title, due_at, assignee)

        description = f"I've added {title}"
        if due_at is not None:
            description += f", due {describe_due_time(due_at, now)}"
        if assignee is not None:
            description += f", for {assignee}"
        return SkillReply(f"{description}.")

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

        # A spoken due time always has a time of day, so the reminder is no longer all day.
        self._reminders_client.save_reminder(replace(reminder, due_at=due_at, is_all_day=False))
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


def _describe_when_due(reminder: Reminder, now: datetime, is_only_today: bool) -> str:
    # When only today was asked about, saying "today" for each reminder due today would be needless.
    is_due_today = reminder.due_at.date() == now.date()
    if reminder.is_all_day:
        return "all day" if is_only_today and is_due_today else f"due {describe_day(reminder.due_at.date(), now.date())}"
    if is_only_today and is_due_today:
        return f"at {describe_time_of_day(reminder.due_at)}"
    return f"due {describe_due_time(reminder.due_at, now)}"


def _find_assignee(spoken_name: str) -> str | None:
    return next((assignee for assignee in _ASSIGNEES if assignee.casefold() == spoken_name.strip().casefold()), None)
