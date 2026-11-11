from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from alexa_api.core.reminder import Reminder
from alexa_api.core.reminders_client import RemindersClient, RemindersUnavailableError
from tests.fake_reminders_api import create_failing_reminders_api, create_fake_reminders_api


def test_creates_reminder_with_due_time_and_time_zone_when_adding_reminder() -> None:
    held_reminders: list[dict[str, Any]] = []
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))
    due_at = datetime(2026, 6, 11, 17, 0, tzinfo=ZoneInfo("Europe/London"))

    client.add_reminder("Buy milk", due_at)

    assert held_reminders == [{"title": "Buy milk", "due_at": "2026-06-11T17:00:00+01:00", "completed_at": None}]


def test_creates_reminder_with_no_due_time_when_adding_reminder_without_one() -> None:
    held_reminders: list[dict[str, Any]] = []
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    client.add_reminder("Buy milk", due_at=None)

    assert held_reminders == [{"title": "Buy milk", "due_at": None, "completed_at": None}]


def test_lists_only_reminders_without_completion_time_when_listing_unfinished_reminders() -> None:
    held_reminders = [
        {"title": "Buy milk", "due_at": "2026-11-11T17:00:00Z", "completed_at": None},
        {"title": "Call the dentist", "due_at": None, "completed_at": "2026-11-10T09:00:00Z"},
        {"title": "Water the plants", "due_at": None, "completed_at": None},
    ]
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    reminders = client.list_unfinished_reminders()

    assert reminders == [
        Reminder("Buy milk", due_at=datetime(2026, 11, 11, 17, 0, tzinfo=UTC)),
        Reminder("Water the plants", due_at=None),
    ]


@pytest.mark.parametrize("status_code", [None, 422, 500])
def test_raises_unavailable_error_when_adding_reminder_fails(status_code: int | None) -> None:
    client = RemindersClient("http://reminders-api", create_failing_reminders_api(status_code))

    with pytest.raises(RemindersUnavailableError):
        client.add_reminder("Buy milk", due_at=None)


@pytest.mark.parametrize("status_code", [None, 500])
def test_raises_unavailable_error_when_listing_reminders_fails(status_code: int | None) -> None:
    client = RemindersClient("http://reminders-api", create_failing_reminders_api(status_code))

    with pytest.raises(RemindersUnavailableError):
        client.list_unfinished_reminders()
