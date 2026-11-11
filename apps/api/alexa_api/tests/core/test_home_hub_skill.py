from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from alexa_api.core.home_hub_skill import HomeHubSkill
from alexa_api.core.reminders_client import RemindersClient
from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest
from tests.fake_reminders_api import create_failing_reminders_api, create_fake_reminders_api

_WEDNESDAY_NOON = datetime(2026, 11, 11, 12, 0, tzinfo=UTC)


def _create_skill(held_reminders: list[dict[str, Any]]) -> HomeHubSkill:
    reminders_client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))
    return HomeHubSkill(reminders_client, ZoneInfo("Europe/London"))


def test_asks_for_due_time_and_remembers_capitalised_title_when_reminder_is_started() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest("AddReminderIntent", _WEDNESDAY_NOON, slots={"title": "buy milk"}))

    assert reply.speech == "When is it due? You can say a day, a time, or no time."
    assert reply.reprompt is not None
    assert reply.conversation_memory == {"reminder_title": "Buy milk"}
    assert held_reminders == []


def test_asks_what_the_reminder_is_when_reminder_is_started_without_title() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest("AddReminderIntent", _WEDNESDAY_NOON))

    assert reply.speech == "What should I remind you about? Say, remind me to, and then the reminder."
    assert reply.reprompt is not None
    assert held_reminders == []


def test_adds_reminder_and_ends_conversation_when_due_time_is_said() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest(
        "SetDueTimeIntent",
        _WEDNESDAY_NOON,
        slots={"date": "2026-11-12", "time": "17:00"},
        conversation_memory={"reminder_title": "Buy milk"},
    ))

    assert reply == SkillReply("I've added Buy milk, due tomorrow at 5 PM.")
    assert held_reminders == [{"title": "Buy milk", "due_at": "2026-11-12T17:00:00+00:00", "completed_at": None}]


def test_adds_reminder_at_home_clock_time_when_summer_time_is_in_force() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)
    summer_noon = datetime(2026, 6, 10, 11, 0, tzinfo=UTC)

    skill.respond(SkillRequest(
        "SetDueTimeIntent",
        summer_noon,
        slots={"time": "17:00"},
        conversation_memory={"reminder_title": "Buy milk"},
    ))

    assert held_reminders[0]["due_at"] == "2026-06-10T17:00:00+01:00"


def test_asks_again_and_keeps_title_when_due_time_cannot_be_resolved() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest(
        "SetDueTimeIntent",
        _WEDNESDAY_NOON,
        slots={"date": "2026-W47"},
        conversation_memory={"reminder_title": "Buy milk"},
    ))

    assert reply.speech == "Sorry, I didn't catch when. When is it due? You can say a day, a time, or no time."
    assert reply.reprompt is not None
    assert reply.conversation_memory == {"reminder_title": "Buy milk"}
    assert held_reminders == []


def test_asks_what_the_reminder_is_when_due_time_is_said_before_any_title() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest("SetDueTimeIntent", _WEDNESDAY_NOON, slots={"time": "17:00"}))

    assert reply.speech == "First tell me what the reminder is. Say, remind me to, and then the reminder."
    assert reply.reprompt is not None
    assert held_reminders == []


@pytest.mark.parametrize("intent_name", ["NoDueTimeIntent", "AMAZON.NoIntent"])
def test_adds_reminder_without_due_time_when_person_declines_to_give_one(intent_name: str) -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest(intent_name, _WEDNESDAY_NOON, conversation_memory={"reminder_title": "Buy milk"}))

    assert reply == SkillReply("I've added Buy milk.")
    assert held_reminders == [{"title": "Buy milk", "due_at": None, "completed_at": None}]


def test_adds_nothing_and_ends_conversation_when_person_says_no_before_any_title() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest("AMAZON.NoIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("OK.")
    assert held_reminders == []


def test_reads_out_unfinished_reminders_due_today_or_earlier_in_due_order_when_listing() -> None:
    skill = _create_skill([
        {"title": "Buy milk", "due_at": "2026-11-11T17:00:00Z", "completed_at": None},
        {"title": "Call the dentist", "due_at": "2026-11-10T09:30:00Z", "completed_at": None},
        {"title": "Already done", "due_at": "2026-11-11T08:00:00Z", "completed_at": "2026-11-11T08:05:00Z"},
        {"title": "Due tomorrow", "due_at": "2026-11-12T09:00:00Z", "completed_at": None},
        {"title": "Never due", "due_at": None, "completed_at": None},
    ])

    reply = skill.respond(SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("You have 2 reminders due. Call the dentist, due yesterday at 9:30 AM. Buy milk, at 5 PM.")


def test_counts_a_single_reminder_in_the_singular_when_listing() -> None:
    skill = _create_skill([{"title": "Buy milk", "due_at": "2026-11-11T17:00:00Z", "completed_at": None}])

    reply = skill.respond(SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("You have 1 reminder due. Buy milk, at 5 PM.")


def test_uses_home_time_zone_to_decide_which_day_a_reminder_is_due_when_listing() -> None:
    skill = _create_skill([{"title": "Late film", "due_at": "2026-06-10T23:30:00Z", "completed_at": None}])
    summer_noon = datetime(2026, 6, 10, 11, 0, tzinfo=UTC)

    reply = skill.respond(SkillRequest("ListRemindersIntent", summer_noon))

    assert reply == SkillReply("Nothing is due today.")


def test_says_nothing_is_due_when_listing_with_no_reminders() -> None:
    skill = _create_skill([])

    reply = skill.respond(SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON))

    assert reply == SkillReply("Nothing is due today.")


@pytest.mark.parametrize("request_name", ["LaunchRequest", "AMAZON.HelpIntent"])
def test_explains_what_can_be_said_and_keeps_listening_when_opened_or_asked_for_help(request_name: str) -> None:
    skill = _create_skill([])

    reply = skill.respond(SkillRequest(request_name, _WEDNESDAY_NOON))

    assert reply.speech == "You can say, remind me to water the plants. Or ask, what's due today."
    assert reply.reprompt is not None


@pytest.mark.parametrize("intent_name", ["AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent"])
def test_ends_conversation_without_adding_reminder_when_person_stops_part_way(intent_name: str) -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(held_reminders)

    reply = skill.respond(SkillRequest(intent_name, _WEDNESDAY_NOON, conversation_memory={"reminder_title": "Buy milk"}))

    assert reply == SkillReply("OK.")
    assert held_reminders == []


def test_says_nothing_when_alexa_reports_that_the_conversation_ended() -> None:
    skill = _create_skill([])

    reply = skill.respond(SkillRequest("SessionEndedRequest", _WEDNESDAY_NOON))

    assert reply == SkillReply(speech=None)


@pytest.mark.parametrize("unhandled_name", ["AMAZON.FallbackIntent", "IntentAddedToModelButNotHandledYet"])
def test_apologises_and_ends_conversation_when_request_is_not_handled(unhandled_name: str) -> None:
    skill = _create_skill([])

    reply = skill.respond(SkillRequest(unhandled_name, _WEDNESDAY_NOON))

    assert reply == SkillReply("Sorry, I can't do that yet.")


def test_asks_for_due_time_again_and_keeps_title_when_answer_is_not_understood() -> None:
    skill = _create_skill([])

    reply = skill.respond(SkillRequest(
        "AMAZON.FallbackIntent",
        _WEDNESDAY_NOON,
        conversation_memory={"reminder_title": "Buy milk"},
    ))

    assert reply.speech == "Sorry, I didn't catch that. When is it due? You can say a day, a time, or no time."
    assert reply.reprompt is not None
    assert reply.conversation_memory == {"reminder_title": "Buy milk"}


@pytest.mark.parametrize(
    "request_that_needs_reminders",
    [
        SkillRequest("ListRemindersIntent", _WEDNESDAY_NOON),
        SkillRequest("NoDueTimeIntent", _WEDNESDAY_NOON, conversation_memory={"reminder_title": "Buy milk"}),
        SkillRequest("SetDueTimeIntent", _WEDNESDAY_NOON, {"time": "17:00"}, {"reminder_title": "Buy milk"}),
    ],
)
def test_says_reminders_could_not_be_reached_when_reminders_api_is_unavailable(
        request_that_needs_reminders: SkillRequest,
) -> None:
    reminders_client = RemindersClient("http://reminders-api", create_failing_reminders_api())
    skill = HomeHubSkill(reminders_client, ZoneInfo("Europe/London"))

    reply = skill.respond(request_that_needs_reminders)

    assert reply == SkillReply("Sorry, I couldn't reach your reminders. Please try again later.")
