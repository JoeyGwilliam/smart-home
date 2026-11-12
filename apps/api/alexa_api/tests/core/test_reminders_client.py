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
        {"id": "new-reminder", "title": "Buy milk", "notes": None, "due_at": "2026-06-11T17:00:00+01:00", "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None},
    ]


def test_creates_reminder_assigned_to_person_when_adding_reminder_for_them() -> None:
    held_reminders: list[dict[str, Any]] = []
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    client.add_reminder("Buy milk", due_at=None, assigned_to="Georgie")

    assert held_reminders[0]["assigned_to"] == "Georgie"


def test_creates_reminder_with_no_due_time_when_adding_reminder_without_one() -> None:
    held_reminders: list[dict[str, Any]] = []
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    client.add_reminder("Buy milk", due_at=None)

    assert held_reminders[0]["title"] == "Buy milk"
    assert held_reminders[0]["due_at"] is None


def test_lists_only_reminders_without_completion_time_when_listing_unfinished_reminders() -> None:
    held_reminders = [
        {"id": "milk", "title": "Buy milk", "notes": "Semi-skimmed", "due_at": "2026-11-11T00:00:00Z", "is_all_day": True, "completed_at": None, "repeats": "weekly", "assigned_to": None},
        {"id": "dentist", "title": "Call the dentist", "notes": None, "due_at": None, "is_all_day": False, "completed_at": "2026-11-10T09:00:00Z", "repeats": None, "assigned_to": None},
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": "Georgie"},
    ]
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    reminders = client.list_unfinished_reminders()

    assert reminders == [
        Reminder("milk", "Buy milk", notes="Semi-skimmed", due_at=datetime(2026, 11, 11, tzinfo=UTC), is_all_day=True, repeats="weekly"),
        Reminder("plants", "Water the plants", assigned_to="Georgie"),
    ]


def test_replaces_every_field_of_held_reminder_when_saving_reminder() -> None:
    held_reminders = [
        {"id": "milk", "title": "Buy milk", "notes": "Semi-skimmed", "due_at": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None},
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None},
    ]
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))
    completed_reminder = Reminder(
        "milk",
        "Buy milk",
        notes="Semi-skimmed",
        due_at=datetime(2026, 11, 11, tzinfo=UTC),
        is_all_day=True,
        completed_at=datetime(2026, 11, 11, 12, 0, tzinfo=UTC),
        repeats="weekly",
        assigned_to="Joey",
    )

    client.save_reminder(completed_reminder)

    assert held_reminders == [
        {
            "id": "milk",
            "title": "Buy milk",
            "notes": "Semi-skimmed",
            "due_at": "2026-11-11T00:00:00+00:00",
            "is_all_day": True,
            "completed_at": "2026-11-11T12:00:00+00:00",
            "repeats": "weekly",
            "assigned_to": "Joey",
        },
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None},
    ]


def test_removes_only_that_reminder_when_deleting_reminder() -> None:
    held_reminders = [
        {"id": "milk", "title": "Buy milk", "notes": None, "due_at": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None},
        {"id": "plants", "title": "Water the plants", "notes": None, "due_at": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None},
    ]
    client = RemindersClient("http://reminders-api", create_fake_reminders_api(held_reminders))

    client.delete_reminder(Reminder("milk", "Buy milk"))

    assert [reminder["id"] for reminder in held_reminders] == ["plants"]


@pytest.mark.parametrize("status_code", [None, 422, 500])
def test_raises_unavailable_error_when_reminders_api_fails(status_code: int | None) -> None:
    client = RemindersClient("http://reminders-api", create_failing_api(status_code))

    with pytest.raises(HomeApiUnavailableError):
        client.add_reminder("Buy milk", due_at=None)
