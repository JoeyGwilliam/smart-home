from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import pytest

from alexa_api.core.home_hub_skill import HomeHubSkill
from alexa_api.core.reminder_controls import ReminderControls
from alexa_api.core.reminders_client import RemindersClient
from alexa_api.core.site_editor_client import SiteEditorClient
from alexa_api.core.site_editor_controls import SiteEditorControls
from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest
from alexa_api.core.timer_controls import TimerControls
from alexa_api.core.timers_client import TimersClient
from tests.fake_home_apis import create_failing_api, create_fake_reminders_api, create_fake_site_editor_api, create_fake_timers_api

_NOON = datetime(2026, 11, 11, 12, 0, tzinfo=UTC)


def _create_skill(
        reminders_api: httpx.BaseTransport | None = None,
        timers_api: httpx.BaseTransport | None = None,
        site_editor_api: httpx.BaseTransport | None = None,
) -> HomeHubSkill:
    return HomeHubSkill(
        ReminderControls(RemindersClient("http://reminders-api", reminders_api or create_fake_reminders_api([])), ZoneInfo("Europe/London")),
        TimerControls(TimersClient("http://timers-api", timers_api or create_fake_timers_api([], {}))),
        SiteEditorControls(SiteEditorClient("http://site-editor", site_editor_api or create_fake_site_editor_api([]))),
    )


def test_hands_request_about_reminders_to_reminder_controls_when_responding() -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(reminders_api=create_fake_reminders_api(held_reminders))

    reply = skill.respond(SkillRequest("NoDueTimeIntent", _NOON, conversation_memory={"new_reminder_title": "Buy milk"}))

    assert reply == SkillReply("I've added Buy milk.")
    assert [reminder["title"] for reminder in held_reminders] == ["Buy milk"]


def test_hands_request_about_timer_to_timer_controls_when_responding() -> None:
    active_timer: dict[str, Any] = {"plan": {"name": "Bedtime"}, "started_at": "2026-11-11T11:00:00Z"}
    skill = _create_skill(timers_api=create_fake_timers_api([], active_timer))

    reply = skill.respond(SkillRequest("StopTimerIntent", _NOON))

    assert reply == SkillReply("I've stopped the timer.")
    assert active_timer["started_at"] is None


def test_hands_request_about_site_to_site_editor_controls_when_responding() -> None:
    received_messages: list[str] = []
    skill = _create_skill(site_editor_api=create_fake_site_editor_api(received_messages))

    skill.respond(SkillRequest("RequestSiteChangeIntent", _NOON, slots={"request": "make the clock bigger"}))

    assert received_messages == ["Make the clock bigger"]


def test_says_it_is_listening_and_keeps_listening_when_opened() -> None:
    skill = _create_skill()

    reply = skill.respond(SkillRequest("LaunchRequest", _NOON))

    assert reply.speech == "I'm listening."
    assert reply.reprompt is not None


def test_explains_where_to_find_what_can_be_said_and_keeps_listening_when_asked_for_help() -> None:
    skill = _create_skill()

    reply = skill.respond(SkillRequest("AMAZON.HelpIntent", _NOON))

    assert reply.speech == "The Alexa controls page on the site lists everything you can say."
    assert reply.reprompt is not None


@pytest.mark.parametrize("intent_name", ["AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent"])
def test_ends_conversation_without_finishing_the_job_when_person_stops_part_way(intent_name: str) -> None:
    held_reminders: list[dict[str, Any]] = []
    skill = _create_skill(reminders_api=create_fake_reminders_api(held_reminders))

    reply = skill.respond(SkillRequest(intent_name, _NOON, conversation_memory={"new_reminder_title": "Buy milk"}))

    assert reply == SkillReply("OK.")
    assert held_reminders == []


def test_says_nothing_when_alexa_reports_that_the_conversation_ended() -> None:
    skill = _create_skill()

    reply = skill.respond(SkillRequest("SessionEndedRequest", _NOON))

    assert reply == SkillReply(speech=None)


@pytest.mark.parametrize("unhandled_name", ["AMAZON.FallbackIntent", "IntentAddedToModelButNotHandledYet"])
def test_apologises_and_ends_conversation_when_request_is_not_handled(unhandled_name: str) -> None:
    skill = _create_skill()

    reply = skill.respond(SkillRequest(unhandled_name, _NOON))

    assert reply == SkillReply("Sorry, I can't do that yet.")


def test_asks_unanswered_question_again_and_keeps_memory_when_answer_is_not_understood() -> None:
    skill = _create_skill()
    memory = {"new_reminder_title": "Buy milk", "question": "When is it due?"}

    reply = skill.respond(SkillRequest("AMAZON.FallbackIntent", _NOON, conversation_memory=memory))

    assert reply == SkillReply(
        "Sorry, I didn't catch that. When is it due?",
        reprompt="When is it due?",
        conversation_memory=memory,
    )


@pytest.mark.parametrize(
    ("request_that_needs_an_api", "expected_speech"),
    [
        (SkillRequest("ListRemindersIntent", _NOON), "Sorry, I couldn't reach the reminders. Please try again later."),
        (SkillRequest("StopTimerIntent", _NOON), "Sorry, I couldn't reach the timers. Please try again later."),
        (SkillRequest("SiteChangeProgressIntent", _NOON), "Sorry, I couldn't reach the site editor. Please try again later."),
    ],
)
def test_says_which_api_could_not_be_reached_when_an_api_is_unavailable(
        request_that_needs_an_api: SkillRequest,
        expected_speech: str,
) -> None:
    skill = _create_skill(create_failing_api(), create_failing_api(), create_failing_api())

    reply = skill.respond(request_that_needs_an_api)

    assert reply == SkillReply(expected_speech)
