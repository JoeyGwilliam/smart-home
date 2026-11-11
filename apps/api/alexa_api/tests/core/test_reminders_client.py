from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from alexa_api.core.home_api import HomeApiUnavailableError
from alexa_api.core.reminder import Reminder
from alexa_api.core.reminders_client import RemindersClient
from tests.fake_home_apis import create_failing_api, create_fake_reminders_api


def test_creates_reminder_with_due_time_and_time_zone_when_adding_reminder() -> None:
    held_reminders: list[dict[str, Any]] = []
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))
    due_at = datetime(2026, 6, 11, 17, 0, tzinfo=ZoneInfo("Europe/London"))

    client.add_reminder("Buy milk", due_at)

    assert held_reminders == [
        {"id": "new-reminder", "title": "Buy milk", "notes": None, "due_at": "2026-06-11T17:00:00+01:00", "completed_at": None},
    ]


def test_creates_reminder_with_no_due_time_when_adding_reminder_without_one() -> None:
    held_reminders: list[dict[str, Any]] = []
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    client.add_reminder("Buy milk", due_at=None)

    assert held_reminders[0]["title"] == "Buy milk"
    assert held_reminders[0]["due_at"] is None


def test_lists_only_reminders_without_completion_time_when_listing_unfinished_reminders() -> None:
    held_reminders = [
        {"id": "milk", "title": "Buy milk", "notes": "Semi-skimmed", "due_at": "2026-11-11T17:00:00Z", "completed_at": None},
        {"id": "dentist", "title": "Call the dentist", "notes": None, "due_at": None, "completed_at": "2026-11-10T09:00:00Z"},
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "completed_at": None},
    ]
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    reminders = client.list_unfinished_reminders()

    assert reminders == [
        Reminder("milk", "Buy milk", notes="Semi-skimmed", due_at=datetime(2026, 11, 11, 17, 0, tzinfo=UTC)),
        Reminder("plants", "Water the plants"),
    ]


def test_replaces_every_field_of_held_reminder_when_saving_reminder() -> None:
    held_reminders = [
        {"id": "milk", "title": "Buy milk", "notes": "Semi-skimmed", "due_at": None, "completed_at": None},
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "completed_at": None},
    ]
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))
    completed_reminder = Reminder(
        "milk",
        "Buy milk",
        notes="Semi-skimmed",
        due_at=datetime(2026, 11, 11, 17, 0, tzinfo=UTC),
        completed_at=datetime(2026, 11, 11, 12, 0, tzinfo=UTC),
    )

    client.save_reminder(completed_reminder)

    assert held_reminders == [
        {
            "id": "milk",
            "title": "Buy milk",
            "notes": "Semi-skimmed",
            "due_at": "2026-11-11T17:00:00+00:00",
            "completed_at": "2026-11-11T12:00:00+00:00",
        },
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "completed_at": None},
    ]


def test_removes_only_that_reminder_when_deleting_reminder() -> None:
    held_reminders = [
        {"id": "milk", "title": "Buy milk", "notes": None, "due_at": None, "completed_at": None},
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "completed_at": None},
    ]
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    client.delete_reminder(Reminder("milk", "Buy milk"))

    assert [reminder["id"] for reminder in held_reminders] == ["plants"]


@pytest.mark.parametrize("status_code", [None, 422, 500])
def test_raises_unavailable_error_when_reminders_api_fails(status_code: int | None) -> None:
    client = RemindersClient("http://reminders-api", create_failing_api(status_code))

    with pytest.raises(HomeApiUnavailableError):
        client.add_reminder("Buy milk", due_at=None)
