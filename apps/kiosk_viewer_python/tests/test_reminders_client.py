import json
from datetime import UTC, datetime
from uuid import UUID

import httpx
import pytest

from kiosk_viewer_python.reminders_client import (
    InvalidReminderError,
    Reminder,
    RemindersClient,
    RemindersUnavailableError,
)

REMINDER_ID = UUID("019a6f2e-7c41-7d3a-9b12-4f8e2a6c1d90")


def test_returns_reminders_when_listing() -> None:
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{
            "id": str(REMINDER_ID),
            "title": "Take out bins",
            "notes": "The blue one",
            "due_at": "2026-11-09T19:00:00Z",
            "completed_at": None,
        }])

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api"))

    reminders = client.list_all()

    assert reminders == [Reminder(
        id=REMINDER_ID,
        title="Take out bins",
        notes="The blue one",
        due_at=datetime(2026, 11, 9, 19, 0, tzinfo=UTC),
        completed_at=None,
    )]


def test_returns_none_when_getting_missing_reminder() -> None:
    client = RemindersClient(httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(404)),
        base_url="http://api",
    ))

    reminder = client.get(REMINDER_ID)

    assert reminder is None


def test_raises_invalid_reminder_error_when_api_rejects_new_reminder() -> None:
    client = RemindersClient(httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(422)),
        base_url="http://api",
    ))

    with pytest.raises(InvalidReminderError):
        client.create("   ", None, None)


def test_raises_unavailable_error_when_api_cannot_be_reached() -> None:
    def fail_to_connect(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(fail_to_connect), base_url="http://api"))

    with pytest.raises(RemindersUnavailableError):
        client.list_all()


def test_raises_unavailable_error_when_api_fails() -> None:
    client = RemindersClient(httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(500)),
        base_url="http://api",
    ))

    with pytest.raises(RemindersUnavailableError):
        client.list_all()


def test_keeps_other_fields_when_ticking_off_reminder() -> None:
    saved_bodies = []

    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={
                "id": str(REMINDER_ID),
                "title": "Take out bins",
                "notes": "The blue one",
                "due_at": "2026-11-09T19:00:00+00:00",
                "completed_at": None,
            })
        saved_bodies.append(json.loads(request.content))
        return httpx.Response(200, json={})

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api"))

    client.toggle_completed(REMINDER_ID)

    assert saved_bodies[0]["title"] == "Take out bins"
    assert saved_bodies[0]["notes"] == "The blue one"
    assert saved_bodies[0]["due_at"] == "2026-11-09T19:00:00+00:00"
    assert saved_bodies[0]["completed_at"] is not None


def test_clears_completed_at_when_unticking_reminder() -> None:
    saved_bodies = []

    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={
                "id": str(REMINDER_ID),
                "title": "Take out bins",
                "notes": None,
                "due_at": None,
                "completed_at": "2026-11-09T18:30:00Z",
            })
        saved_bodies.append(json.loads(request.content))
        return httpx.Response(200, json={})

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api"))

    client.toggle_completed(REMINDER_ID)

    assert saved_bodies[0]["completed_at"] is None


def test_saves_nothing_when_ticking_off_missing_reminder() -> None:
    methods = []

    def respond(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(404)

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api"))

    client.toggle_completed(REMINDER_ID)

    assert methods == ["GET"]


def test_keeps_completion_and_changes_content_when_updating_reminder() -> None:
    saved_bodies = []

    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={
                "id": str(REMINDER_ID),
                "title": "Take out bins",
                "notes": "The blue one",
                "due_at": "2026-11-09T19:00:00Z",
                "completed_at": "2026-11-09T18:30:00Z",
            })
        saved_bodies.append(json.loads(request.content))
        return httpx.Response(200, json={})

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api"))

    client.update(REMINDER_ID, "Take out recycling", None, None)

    assert saved_bodies == [{
        "title": "Take out recycling",
        "notes": None,
        "due_at": None,
        "completed_at": "2026-11-09T18:30:00+00:00",
    }]


def test_saves_nothing_when_updating_missing_reminder() -> None:
    methods = []

    def respond(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(404)

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api"))

    client.update(REMINDER_ID, "Take out recycling", None, None)

    assert methods == ["GET"]


def test_raises_invalid_reminder_error_when_api_rejects_update() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={
                "id": str(REMINDER_ID),
                "title": "Take out bins",
                "notes": None,
                "due_at": None,
                "completed_at": None,
            })
        return httpx.Response(422)

    client = RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api"))

    with pytest.raises(InvalidReminderError):
        client.update(REMINDER_ID, "   ", None, None)
