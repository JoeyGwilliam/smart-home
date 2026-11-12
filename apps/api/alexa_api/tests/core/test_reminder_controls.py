from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from alexa_api.core.reminder_controls import ReminderControls
from alexa_api.core.reminders_client import RemindersClient
from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest
from tests.fake_home_apis import create_fake_reminders_api

_WEDNESDAY_NOON = datetime(2026, 11, 11, 12, 0, tzinfo=UTC)


def _respond(held_reminders: list[dict[str, Any]], request: SkillRequest) -> SkillReply:
    reminders_client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))
    controls = ReminderControls(reminders_client, ZoneInfo("Europe/London"))
    return controls.responders[request.name](request)


def _hold_reminder(
    reminder_id: str, title: str, due_at: str | None = None, completed_at: str | None = None, is_all_day: bool = False,
) -> dict[str, Any]:
    return {"id": reminder_id, "title": title, "notes": None, "due_at": due_at, "is_all_day": is_all_day, "completed_at": completed_at, "repeats": None, "assigned_to": None}


def test_asks_for_due_time_and_remembers_capitalised_title_when_reminder_is_started() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest("AddReminderIntent", _WEDNESDAY_NOON, slots={"title": "buy milk"}))

    assert reply == SkillReply(
        "When is it due? You can say a day, a time, or no time.",
        reprompt="When is it due? You can say a day, a time, or no time.",
        conversation_memory={
            "new_reminder_title": "Buy milk",
            "question": "When is it due? You can say a day, a time, or no time.",
        },
    )
    assert held_reminders == []


def test_asks_what_the_reminder_is_when_reminder_is_started_without_title() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest("AddReminderIntent", _WEDNESDAY_NOON))

    assert reply.speech == "What should I remind you about? Say, remind me to, and then the reminder."
    assert reply.reprompt is not None
    assert held_reminders == []


def test_asks_who_it_is_for_and_remembers_due_time_when_due_time_is_said_for_new_reminder() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest(
        "SetDueTimeIntent",
        _WEDNESDAY_NOON,
        slots={"date": "2026-11-12", "time": "17:00"},
        conversation_memory={"new_reminder_title": "Buy milk", "question": "When is it due?"},
    ))

    assert reply == SkillReply(
        "Who is it for? You can say Joey, Georgie, or nobody.",
        reprompt="Who is it for? You can say Joey, Georgie, or nobody.",
        conversation_memory={
            "new_reminder_title": "Buy milk",
            "new_reminder_due_at": "2026-11-12T17:00:00+00:00",
            "question": "Who is it for? You can say Joey, Georgie, or nobody.",
        },
    )
    assert held_reminders == []


def test_remembers_due_time_at_home_clock_time_when_summer_time_is_in_force() -> None:
    summer_noon = datetime(2026, 6, 10, 11, 0, tzinfo=UTC)

    reply = _respond([], SkillRequest(
        "SetDueTimeIntent",
        summer_noon,
        slots={"time": "17:00"},
        conversation_memory={"new_reminder_title": "Buy milk", "question": "When is it due?"},
    ))

    assert reply.conversation_memory["new_reminder_due_at"] == "2026-06-10T17:00:00+01:00"


def test_asks_same_question_again_and_keeps_memory_when_due_time_cannot_be_resolved() -> None:
    held_reminders: list[dict[str, Any]] = []
    memory = {"new_reminder_title": "Buy milk", "question": "When is it due?"}

    reply = _respond(held_reminders, SkillRequest(
        "SetDueTimeIntent",
        _WEDNESDAY_NOON,
        slots={"date": "2026-W47"},
        conversation_memory=memory,
    ))

    assert reply == SkillReply(
        "Sorry, I didn't catch when. When is it due?",
        reprompt="When is it due?",
        conversation_memory=memory,
    )
    assert held_reminders == []


def test_asks_what_the_reminder_is_when_due_time_is_said_before_anything_else() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest("SetDueTimeIntent", _WEDNESDAY_NOON, slots={"time": "17:00"}))

    assert reply.speech == "First tell me what the reminder is. Say, remind me to, and then the reminder."
    assert reply.reprompt is not None
    assert held_reminders == []


@pytest.mark.parametrize("intent_name", ["NoDueTimeIntent", "AMAZON.NoIntent"])
def test_asks_who_it_is_for_and_remembers_no_due_time_when_person_declines_to_give_one(intent_name: str) -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest(
        intent_name,
        _WEDNESDAY_NOON,
        conversation_memory={"new_reminder_title": "Buy milk", "question": "When is it due?"},
    ))

    assert reply.speech == "Who is it for? You can say Joey, Georgie, or nobody."
    assert reply.conversation_memory["new_reminder_due_at"] == ""
    assert held_reminders == []


def test_adds_reminder_assigned_to_person_and_ends_conversation_when_person_says_who_it_is_for() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest(
        "SetAssigneeIntent",
        _WEDNESDAY_NOON,
        slots={"person": "joey"},
        conversation_memory={
            "new_reminder_title": "Buy milk",
            "new_reminder_due_at": "2026-11-12T17:00:00+00:00",
            "question": "Who is it for?",
        },
    ))

    assert reply == SkillReply("I've added Buy milk, due tomorrow at 5 PM, for Joey.")
    assert held_reminders == [
        {"id": "new-reminder", "title": "Buy milk", "notes": None, "due_at": "2026-11-12T17:00:00+00:00", "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": "Joey"},
    ]


def test_adds_reminder_without_due_time_when_person_says_who_it_is_for_after_declining_a_due_time() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest(
        "SetAssigneeIntent",
        _WEDNESDAY_NOON,
        slots={"person": "Georgie"},
        conversation_memory={"new_reminder_title": "Buy milk", "new_reminder_due_at": "", "question": "Who is it for?"},
    ))

    assert reply == SkillReply("I've added Buy milk, for Georgie.")
    assert held_reminders[0]["due_at"] is None
    assert held_reminders[0]["assigned_to"] == "Georgie"


@pytest.mark.parametrize("intent_name", ["NoAssigneeIntent", "NoDueTimeIntent", "AMAZON.NoIntent"])
def test_adds_unassigned_reminder_when_person_says_nobody(intent_name: str) -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest(
        intent_name,
        _WEDNESDAY_NOON,
        conversation_memory={"new_reminder_title": "Buy milk", "new_reminder_due_at": "", "question": "Who is it for?"},
    ))

    assert reply == SkillReply("I've added Buy milk.")
    assert held_reminders == [
        {"id": "new-reminder", "title": "Buy milk", "notes": None, "due_at": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None},
    ]


def test_asks_same_question_again_and_adds_nothing_when_person_is_not_one_of_the_two() -> None:
    held_reminders: list[dict[str, Any]] = []
    memory = {"new_reminder_title": "Buy milk", "new_reminder_due_at": "", "question": "Who is it for? You can say Joey, Georgie, or nobody."}

    reply = _respond(held_reminders, SkillRequest("SetAssigneeIntent", _WEDNESDAY_NOON, slots={"person": "sam"}, conversation_memory=memory))

    assert reply == SkillReply(
        "Sorry, I didn't catch who. Who is it for? You can say Joey, Georgie, or nobody.",
        reprompt="Who is it for? You can say Joey, Georgie, or nobody.",
        conversation_memory=memory,
    )
    assert held_reminders == []


def test_asks_what_the_reminder_is_when_who_it_is_for_is_said_before_anything_else() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest("SetAssigneeIntent", _WEDNESDAY_NOON, slots={"person": "joey"}))

    assert reply.speech == "First tell me what the reminder is. Say, remind me to, and then the reminder."
    assert held_reminders == []


def test_changes_nothing_and_ends_conversation_when_nobody_is_said_with_nothing_asked() -> None:
    held_reminders = [_hold_reminder("milk", "Buy milk")]

    reply = _respond(held_reminders, SkillRequest("NoAssigneeIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("OK.")
    assert held_reminders == [_hold_reminder("milk", "Buy milk")]


@pytest.mark.parametrize("intent_name", ["NoDueTimeIntent", "AMAZON.NoIntent"])
def test_changes_nothing_and_ends_conversation_when_person_declines_with_nothing_asked(intent_name: str) -> None:
    held_reminders = [_hold_reminder("milk", "Buy milk")]

    reply = _respond(held_reminders, SkillRequest(intent_name, _WEDNESDAY_NOON))

    assert reply == SkillReply("OK.")
    assert held_reminders == [_hold_reminder("milk", "Buy milk")]


def test_reads_out_unfinished_reminders_due_today_or_earlier_in_due_order_when_listing() -> None:
    held_reminders = [
        _hold_reminder("milk", "Buy milk", due_at="2026-11-11T17:00:00Z"),
        _hold_reminder("dentist", "Call the dentist", due_at="2026-11-10T09:30:00Z"),
        _hold_reminder("done", "Already done", due_at="2026-11-11T08:00:00Z", completed_at="2026-11-11T08:05:00Z"),
        _hold_reminder("tomorrow", "Due tomorrow", due_at="2026-11-12T09:00:00Z"),
        _hold_reminder("never", "Never due"),
    ]

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("You have 2 reminders due. Call the dentist, due yesterday at 9:30 AM. Buy milk, at 5 PM.")


def test_counts_a_single_reminder_in_the_singular_when_listing() -> None:
    held_reminders = [_hold_reminder("milk", "Buy milk", due_at="2026-11-11T17:00:00Z")]

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("You have 1 reminder due. Buy milk, at 5 PM.")


def test_uses_home_time_zone_to_decide_which_day_a_reminder_is_due_when_listing() -> None:
    held_reminders = [_hold_reminder("film", "Late film", due_at="2026-06-10T23:30:00Z")]
    summer_noon = datetime(2026, 6, 10, 11, 0, tzinfo=UTC)

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", summer_noon))

    assert reply == SkillReply("Nothing is due today.")


def test_reads_out_all_day_reminders_without_time_when_listing() -> None:
    held_reminders = [
        _hold_reminder("milk", "Buy milk", due_at="2026-11-11T17:00:00Z"),
        _hold_reminder("bins", "Bin day", due_at="2026-11-11T00:00:00Z", is_all_day=True),
        _hold_reminder("dentist", "Call the dentist", due_at="2026-11-10T00:00:00Z", is_all_day=True),
    ]

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("You have 3 reminders due. Call the dentist, due yesterday. Bin day, all day. Buy milk, at 5 PM.")


def test_reads_out_day_of_all_day_reminder_without_time_when_listing_for_this_week() -> None:
    held_reminders = [_hold_reminder("bins", "Bin day", due_at="2026-11-13T00:00:00Z", is_all_day=True)]

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON, slots={"period": "2026-W46"}))

    assert reply == SkillReply("You have 1 reminder due. Bin day, due on Friday.")


def test_keeps_all_day_when_all_day_reminder_is_ticked_off() -> None:
    held_reminders = [_hold_reminder("bins", "Bin day", due_at="2026-11-11T00:00:00Z", is_all_day=True)]

    _respond(held_reminders, SkillRequest("CompleteReminderIntent", _WEDNESDAY_NOON, slots={"title": "bin day"}))

    assert held_reminders[0]["is_all_day"] is True
    assert held_reminders[0]["completed_at"] is not None


def test_says_nothing_is_due_when_listing_with_no_reminders() -> None:
    reply = _respond([], SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("Nothing is due today.")


def test_reads_out_only_reminders_due_that_day_when_listing_for_tomorrow() -> None:
    held_reminders = [
        _hold_reminder("dentist", "Call the dentist", due_at="2026-11-10T09:30:00Z"),
        _hold_reminder("milk", "Buy milk", due_at="2026-11-11T17:00:00Z"),
        _hold_reminder("bins", "Take out the bins", due_at="2026-11-12T19:00:00Z"),
        _hold_reminder("cat", "Feed the cat", due_at="2026-11-12T08:00:00Z"),
        _hold_reminder("friday", "Due Friday", due_at="2026-11-13T09:00:00Z"),
    ]

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON, slots={"period": "2026-11-12"}))

    assert reply == SkillReply("You have 2 reminders due. Feed the cat, due tomorrow at 8 AM. Take out the bins, due tomorrow at 7 PM.")


def test_reads_out_reminders_due_by_end_of_week_and_overdue_with_their_days_when_listing_for_this_week() -> None:
    held_reminders = [
        _hold_reminder("dentist", "Call the dentist", due_at="2026-11-02T09:30:00Z"),
        _hold_reminder("milk", "Buy milk", due_at="2026-11-11T17:00:00Z"),
        _hold_reminder("bins", "Take out the bins", due_at="2026-11-15T19:00:00Z"),
        _hold_reminder("next", "Due next week", due_at="2026-11-16T09:00:00Z"),
    ]

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON, slots={"period": "2026-W46"}))

    assert reply == SkillReply(
        "You have 3 reminders due. Call the dentist, due on Monday 2 November at 9:30 AM. Buy milk, due today at 5 PM. "
        "Take out the bins, due on Sunday at 7 PM."
    )


def test_leaves_out_overdue_reminders_when_listing_for_a_week_still_to_come() -> None:
    held_reminders = [
        _hold_reminder("dentist", "Call the dentist", due_at="2026-11-10T09:30:00Z"),
        _hold_reminder("next", "Pay rent", due_at="2026-11-16T09:00:00Z"),
    ]

    reply = _respond(held_reminders, SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON, slots={"period": "2026-W47"}))

    assert reply == SkillReply("You have 1 reminder due. Pay rent, due on Monday at 9 AM.")


def test_names_the_period_when_listing_for_a_period_with_nothing_due() -> None:
    reply = _respond([], SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON, slots={"period": "2026-W46-WE"}))

    assert reply == SkillReply("Nothing is due this weekend.")


def test_says_what_can_be_checked_when_listing_for_a_month() -> None:
    reply = _respond([], SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON, slots={"period": "2026-11"}))

    assert reply == SkillReply("Sorry, I can only check what's due on a day, at a weekend or in a week.")


def test_completes_matching_reminder_at_time_of_request_when_reminder_is_ticked_off() -> None:
    held_reminders = [_hold_reminder("milk", "Buy milk"), _hold_reminder("bins", "Take out the bins", due_at="2026-11-11T17:00:00Z")]

    reply = _respond(held_reminders, SkillRequest("CompleteReminderIntent", _WEDNESDAY_NOON, slots={"title": "the bins"}))

    assert reply == SkillReply("I've ticked off Take out the bins.")
    assert held_reminders == [
        _hold_reminder("milk", "Buy milk"),
        _hold_reminder("bins", "Take out the bins", due_at="2026-11-11T17:00:00+00:00", completed_at="2026-11-11T12:00:00+00:00"),
    ]


@pytest.mark.parametrize("intent_name", ["CompleteReminderIntent", "ChangeDueTimeIntent", "DeleteReminderIntent"])
def test_changes_nothing_and_says_so_when_no_unfinished_reminder_matches(intent_name: str) -> None:
    held_reminders = [
        _hold_reminder("milk", "Buy milk"),
        _hold_reminder("cat", "Feed the cat", completed_at="2026-11-10T09:00:00Z"),
    ]

    reply = _respond(held_reminders, SkillRequest(intent_name, _WEDNESDAY_NOON, slots={"title": "feed the cat"}))

    assert reply == SkillReply("I couldn't find an unfinished reminder like feed the cat.")
    assert held_reminders == [
        _hold_reminder("milk", "Buy milk"),
        _hold_reminder("cat", "Feed the cat", completed_at="2026-11-10T09:00:00Z"),
    ]


def test_says_reminder_was_not_caught_when_no_title_is_heard() -> None:
    held_reminders = [_hold_reminder("milk", "Buy milk")]

    reply = _respond(held_reminders, SkillRequest("CompleteReminderIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("Sorry, I didn't catch which reminder you meant.")


def test_asks_when_matching_reminder_is_due_when_due_time_change_is_started() -> None:
    held_reminders = [_hold_reminder("bins", "Take out the bins", due_at="2026-11-11T17:00:00Z")]

    reply = _respond(held_reminders, SkillRequest("ChangeDueTimeIntent", _WEDNESDAY_NOON, slots={"title": "the bins"}))

    question = "When is Take out the bins due? You can say a day, a time, or no time."
    assert reply == SkillReply(
        question,
        reprompt=question,
        conversation_memory={"rescheduled_reminder_id": "bins", "question": question},
    )
    assert held_reminders == [_hold_reminder("bins", "Take out the bins", due_at="2026-11-11T17:00:00Z")]


def test_moves_reminder_when_due_time_is_said_for_due_time_change() -> None:
    held_reminders = [_hold_reminder("bins", "Take out the bins", due_at="2026-11-11T17:00:00Z")]

    reply = _respond(held_reminders, SkillRequest(
        "SetDueTimeIntent",
        _WEDNESDAY_NOON,
        slots={"date": "2026-11-13"},
        conversation_memory={"rescheduled_reminder_id": "bins", "question": "When is Take out the bins due?"},
    ))

    assert reply == SkillReply("Take out the bins is now due on Friday at 9 AM.")
    assert held_reminders == [_hold_reminder("bins", "Take out the bins", due_at="2026-11-13T09:00:00+00:00")]


def test_gives_all_day_reminder_a_time_when_due_time_is_said_for_due_time_change() -> None:
    held_reminders = [_hold_reminder("bins", "Bin day", due_at="2026-11-11T00:00:00Z", is_all_day=True)]

    _respond(held_reminders, SkillRequest(
        "SetDueTimeIntent",
        _WEDNESDAY_NOON,
        slots={"date": "2026-11-13", "time": "19:00"},
        conversation_memory={"rescheduled_reminder_id": "bins", "question": "When is Bin day due?"},
    ))

    assert held_reminders == [_hold_reminder("bins", "Bin day", due_at="2026-11-13T19:00:00+00:00")]


@pytest.mark.parametrize("intent_name", ["NoDueTimeIntent", "AMAZON.NoIntent"])
def test_removes_due_time_when_person_declines_to_give_one_for_due_time_change(intent_name: str) -> None:
    held_reminders = [_hold_reminder("bins", "Take out the bins", due_at="2026-11-11T17:00:00Z")]

    reply = _respond(held_reminders, SkillRequest(
        intent_name,
        _WEDNESDAY_NOON,
        conversation_memory={"rescheduled_reminder_id": "bins", "question": "When is Take out the bins due?"},
    ))

    assert reply == SkillReply("Take out the bins no longer has a due time.")
    assert held_reminders == [_hold_reminder("bins", "Take out the bins")]


def test_says_reminder_has_gone_when_it_was_deleted_before_due_time_was_said() -> None:
    held_reminders: list[dict[str, Any]] = []

    reply = _respond(held_reminders, SkillRequest(
        "SetDueTimeIntent",
        _WEDNESDAY_NOON,
        slots={"date": "2026-11-13"},
        conversation_memory={"rescheduled_reminder_id": "bins", "question": "When is Take out the bins due?"},
    ))

    assert reply == SkillReply("That reminder has already gone.")
    assert held_reminders == []


def test_asks_before_deleting_matching_reminder_when_deletion_is_started() -> None:
    held_reminders = [_hold_reminder("milk", "Buy milk"), _hold_reminder("bins", "Take out the bins")]

    reply = _respond(held_reminders, SkillRequest("DeleteReminderIntent", _WEDNESDAY_NOON, slots={"title": "the bins"}))

    assert reply == SkillReply(
        "Delete Take out the bins?",
        reprompt="Delete Take out the bins?",
        conversation_memory={"deleted_reminder_id": "bins", "question": "Delete Take out the bins?"},
    )
    assert len(held_reminders) == 2


def test_deletes_only_that_reminder_when_person_says_yes_to_deleting() -> None:
    held_reminders = [_hold_reminder("milk", "Buy milk"), _hold_reminder("bins", "Take out the bins")]

    reply = _respond(held_reminders, SkillRequest(
        "AMAZON.YesIntent",
        _WEDNESDAY_NOON,
        conversation_memory={"deleted_reminder_id": "bins", "question": "Delete Take out the bins?"},
    ))

    assert reply == SkillReply("I've deleted Take out the bins.")
    assert held_reminders == [_hold_reminder("milk", "Buy milk")]


def test_keeps_reminder_when_person_says_no_to_deleting() -> None:
    held_reminders = [_hold_reminder("bins", "Take out the bins")]

    reply = _respond(held_reminders, SkillRequest(
        "AMAZON.NoIntent",
        _WEDNESDAY_NOON,
        conversation_memory={"deleted_reminder_id": "bins", "question": "Delete Take out the bins?"},
    ))

    assert reply == SkillReply("OK, I've kept it.")
    assert held_reminders == [_hold_reminder("bins", "Take out the bins")]


def test_asks_same_question_again_when_person_says_yes_to_a_question_about_due_time() -> None:
    held_reminders: list[dict[str, Any]] = []
    memory = {"new_reminder_title": "Buy milk", "question": "When is it due?"}

    reply = _respond(held_reminders, SkillRequest("AMAZON.YesIntent", _WEDNESDAY_NOON, conversation_memory=memory))

    assert reply == SkillReply(
        "Sorry, I didn't catch that. When is it due?",
        reprompt="When is it due?",
        conversation_memory=memory,
    )
    assert held_reminders == []


def test_changes_nothing_when_person_says_yes_with_nothing_asked() -> None:
    held_reminders = [_hold_reminder("bins", "Take out the bins")]

    reply = _respond(held_reminders, SkillRequest("AMAZON.YesIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("Sorry, I'm not sure what you're saying yes to.")
    assert held_reminders == [_hold_reminder("bins", "Take out the bins")]
