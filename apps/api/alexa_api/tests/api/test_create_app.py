from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pytest
from fastapi.testclient import TestClient

from alexa_api.api.create_app import create_app, create_app_from_environment
from alexa_api.core.alexa_request_verifier import AlexaRequestVerifier
from alexa_api.core.home_hub_skill import HomeHubSkill
from alexa_api.core.reminder_controls import ReminderControls
from alexa_api.core.reminders_client import RemindersClient
from alexa_api.core.site_editor_client import SiteEditorClient
from alexa_api.core.site_editor_controls import SiteEditorControls
from alexa_api.core.timer_controls import TimerControls
from alexa_api.core.timers_client import TimersClient
from tests.fake_alexa import FakeAlexa
from tests.fake_home_apis import create_fake_reminders_api, create_fake_site_editor_api, create_fake_timers_api


def _create_client(alexa: FakeAlexa, held_reminders: list[dict[str, Any]]) -> TestClient:
    reminders_client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))
    skill = HomeHubSkill(
        ReminderControls(reminders_client, ZoneInfo("Europe/London")),
        TimerControls(TimersClient("http://timers-api", create_fake_timers_api([], {}))),
        SiteEditorControls(SiteEditorClient("http://site-editor", create_fake_site_editor_api([]))),
    )
    verifier = AlexaRequestVerifier(alexa.skill_id, alexa.trusted_roots, alexa.download_certificate_chain)
    return TestClient(create_app(skill, verifier))


def test_asks_question_and_keeps_conversation_open_when_person_starts_reminder() -> None:
    alexa = FakeAlexa()
    client = _create_client(alexa, held_reminders=[])
    body = alexa.create_request_body({
        "type": "IntentRequest",
        "intent": {"name": "AddReminderIntent", "slots": {"title": {"name": "title", "value": "buy milk"}}},
    })

    response = client.post("/", content=body, headers=alexa.create_headers(body))

    assert response.status_code == 200
    assert response.json() == {
        "version": "1.0",
        "sessionAttributes": {
            "new_reminder_title": "Buy milk",
            "question": "When is it due? You can say a day, a time, or no time.",
        },
        "response": {
            "outputSpeech": {"type": "PlainText", "text": "When is it due? You can say a day, a time, or no time."},
            "reprompt": {
                "outputSpeech": {"type": "PlainText", "text": "When is it due? You can say a day, a time, or no time."},
            },
            "shouldEndSession": False,
        },
    }


def test_adds_reminder_and_ends_conversation_when_person_answers_with_due_time() -> None:
    alexa = FakeAlexa()
    held_reminders: list[dict[str, Any]] = []
    client = _create_client(alexa, held_reminders)
    body = alexa.create_request_body(
        {
            "type": "IntentRequest",
            "intent": {
                "name": "SetDueTimeIntent",
                "slots": {"date": {"name": "date", "value": "2030-01-01"}, "time": {"name": "time"}},
            },
        },
        conversation_memory={"new_reminder_title": "Buy milk", "question": "When is it due?"},
    )

    response = client.post("/", content=body, headers=alexa.create_headers(body))

    assert response.json() == {
        "version": "1.0",
        "sessionAttributes": {},
        "response": {
            "outputSpeech": {"type": "PlainText", "text": "I've added Buy milk, due on Tuesday 1 January at 9 AM."},
            "shouldEndSession": True,
        },
    }
    assert held_reminders == [
        {"id": "new-reminder", "title": "Buy milk", "notes": None, "due_at": "2030-01-01T09:00:00+00:00", "completed_at": None},
    ]


def test_returns_empty_response_when_alexa_reports_that_the_conversation_ended() -> None:
    alexa = FakeAlexa()
    client = _create_client(alexa, held_reminders=[])
    body = alexa.create_request_body({"type": "SessionEndedRequest", "reason": "USER_INITIATED"})

    response = client.post("/", content=body, headers=alexa.create_headers(body))

    assert response.status_code == 200
    assert response.json() == {"version": "1.0", "sessionAttributes": {}, "response": {}}


def test_returns_400_and_adds_nothing_when_request_has_no_signature_headers() -> None:
    alexa = FakeAlexa()
    held_reminders: list[dict[str, Any]] = []
    client = _create_client(alexa, held_reminders)
    body = alexa.create_request_body(
        {"type": "IntentRequest", "intent": {"name": "NoDueTimeIntent"}},
        conversation_memory={"new_reminder_title": "Buy milk"},
    )

    response = client.post("/", content=body)

    assert response.status_code == 400
    assert held_reminders == []


def test_returns_400_and_adds_nothing_when_signature_is_for_a_different_body() -> None:
    alexa = FakeAlexa()
    held_reminders: list[dict[str, Any]] = []
    client = _create_client(alexa, held_reminders)
    signed_body = alexa.create_request_body()
    sent_body = alexa.create_request_body(
        {"type": "IntentRequest", "intent": {"name": "NoDueTimeIntent"}},
        conversation_memory={"new_reminder_title": "Buy milk"},
    )

    response = client.post("/", content=sent_body, headers=alexa.create_headers(signed_body))

    assert response.status_code == 400
    assert held_reminders == []


def test_does_not_say_why_when_refusing_request() -> None:
    alexa = FakeAlexa()
    client = _create_client(alexa, held_reminders=[])
    body = alexa.create_request_body(skill_id="amzn1.ask.skill.someone-elses-skill")

    response = client.post("/", content=body, headers=alexa.create_headers(body))

    assert response.status_code == 400
    assert response.json() == {"detail": "The request couldn't be verified."}


def test_returns_204_when_checking_health() -> None:
    client = _create_client(FakeAlexa(), held_reminders=[])

    response = client.get("/health")

    assert response.status_code == 204


def test_returns_404_when_asking_for_api_description() -> None:
    client = _create_client(FakeAlexa(), held_reminders=[])

    response = client.get("/openapi.json")

    assert response.status_code == 404


def test_creates_app_when_every_environment_variable_is_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALEXA_SKILL_ID", "amzn1.ask.skill.this-skill")
    monkeypatch.setenv("REMINDERS_API_URL", "http://reminders-api:8000")
    monkeypatch.setenv("TIMERS_API_URL", "http://timers-api:8000")
    monkeypatch.setenv("SITE_EDITOR_API_URL", "http://host.docker.internal:8002")
    monkeypatch.setenv("HOME_TIME_ZONE", "Europe/London")

    app = create_app_from_environment()

    assert TestClient(app).get("/health").status_code == 204


@pytest.mark.parametrize(
    "missing_variable",
    ["ALEXA_SKILL_ID", "REMINDERS_API_URL", "TIMERS_API_URL", "SITE_EDITOR_API_URL", "HOME_TIME_ZONE"],
)
def test_raises_key_error_when_environment_variable_is_not_set(
        monkeypatch: pytest.MonkeyPatch,
        missing_variable: str,
) -> None:
    monkeypatch.setenv("ALEXA_SKILL_ID", "amzn1.ask.skill.this-skill")
    monkeypatch.setenv("REMINDERS_API_URL", "http://reminders-api:8000")
    monkeypatch.setenv("TIMERS_API_URL", "http://timers-api:8000")
    monkeypatch.setenv("SITE_EDITOR_API_URL", "http://host.docker.internal:8002")
    monkeypatch.setenv("HOME_TIME_ZONE", "Europe/London")
    monkeypatch.delenv(missing_variable)

    with pytest.raises(KeyError, match=missing_variable):
        create_app_from_environment()


def test_raises_zone_info_not_found_error_when_time_zone_does_not_exist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALEXA_SKILL_ID", "amzn1.ask.skill.this-skill")
    monkeypatch.setenv("REMINDERS_API_URL", "http://reminders-api:8000")
    monkeypatch.setenv("TIMERS_API_URL", "http://timers-api:8000")
    monkeypatch.setenv("SITE_EDITOR_API_URL", "http://host.docker.internal:8002")
    monkeypatch.setenv("HOME_TIME_ZONE", "Europe/Atlantis")

    with pytest.raises(ZoneInfoNotFoundError):
        create_app_from_environment()
