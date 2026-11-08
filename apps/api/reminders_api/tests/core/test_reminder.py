from dataclasses import replace
from datetime import UTC, datetime

import pytest

from reminders_api.core.reminder import Reminder


@pytest.mark.parametrize("blank_title", ["", "   "])
def test_raises_value_error_when_title_is_blank(blank_title: str) -> None:
    with pytest.raises(ValueError, match="title"):
        Reminder(title=blank_title)


def test_raises_value_error_when_due_at_has_no_time_zone() -> None:
    due_at_without_time_zone = datetime(2026, 11, 8, 9, 0)

    with pytest.raises(ValueError, match="due_at"):
        Reminder(title="Take out bins", due_at=due_at_without_time_zone)


def test_raises_value_error_when_completed_at_has_no_time_zone() -> None:
    completed_at_without_time_zone = datetime(2026, 11, 8, 9, 0)

    with pytest.raises(ValueError, match="completed_at"):
        Reminder(title="Take out bins", completed_at=completed_at_without_time_zone)


def test_accepts_reminder_when_datetimes_have_time_zones() -> None:
    due_at = datetime(2026, 11, 8, 9, 0, tzinfo=UTC)
    completed_at = datetime(2026, 11, 8, 10, 0, tzinfo=UTC)

    reminder = Reminder(title="Take out bins", due_at=due_at, completed_at=completed_at)

    assert reminder.due_at == due_at
    assert reminder.completed_at == completed_at


def test_keeps_id_when_reminder_is_copied_with_changes() -> None:
    reminder = Reminder(title="Take out bins")

    edited_reminder = replace(reminder, title="Take out recycling")

    assert edited_reminder.id == reminder.id
    assert edited_reminder.title == "Take out recycling"


def test_generates_different_ids_when_reminders_have_identical_content() -> None:
    first_reminder = Reminder(title="Take out bins")
    second_reminder = Reminder(title="Take out bins")

    assert first_reminder.id != second_reminder.id
