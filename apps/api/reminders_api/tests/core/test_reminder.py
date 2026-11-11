from dataclasses import replace
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest

from reminders_api.core.assignee import Assignee
from reminders_api.core.reminder import Reminder
from reminders_api.core.repeat import Repeat


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


def test_raises_value_error_when_reminder_repeats_without_due_time() -> None:
    with pytest.raises(ValueError, match="due_at"):
        Reminder(title="Take out bins", repeats=Repeat.WEEKLY)


def test_creates_uncompleted_copy_due_one_repeat_later_when_creating_next_occurrence() -> None:
    reminder = Reminder(
        title="Take out bins",
        notes="The blue one",
        due_at=datetime(2026, 11, 10, 19, 0, tzinfo=UTC),
        completed_at=datetime(2026, 11, 10, 18, 0, tzinfo=UTC),
        repeats=Repeat.WEEKLY,
    )

    next_reminder = reminder.create_next_occurrence(ZoneInfo("Europe/London"))

    assert next_reminder.id != reminder.id
    assert next_reminder.title == "Take out bins"
    assert next_reminder.notes == "The blue one"
    assert next_reminder.due_at == datetime(2026, 11, 17, 19, 0, tzinfo=UTC)
    assert next_reminder.completed_at is None
    assert next_reminder.repeats == Repeat.WEEKLY


def test_keeps_assignee_when_creating_next_occurrence() -> None:
    reminder = Reminder(
        title="Take out bins",
        due_at=datetime(2026, 11, 10, 19, 0, tzinfo=UTC),
        repeats=Repeat.WEEKLY,
        assigned_to=Assignee.JOEY,
    )

    next_reminder = reminder.create_next_occurrence(ZoneInfo("Europe/London"))

    assert next_reminder.assigned_to == Assignee.JOEY


def test_skips_missed_repeats_when_reminder_was_completed_long_after_it_was_due() -> None:
    reminder = Reminder(
        title="Water plants",
        due_at=datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
        completed_at=datetime(2026, 11, 5, 12, 0, tzinfo=UTC),
        repeats=Repeat.DAILY,
    )

    next_reminder = reminder.create_next_occurrence(ZoneInfo("Europe/London"))

    assert next_reminder.due_at == datetime(2026, 11, 6, 9, 0, tzinfo=UTC)


def test_keeps_home_clock_time_when_clocks_change_before_next_occurrence() -> None:
    nine_am_in_london_summer = datetime(2026, 10, 24, 8, 0, tzinfo=UTC)
    reminder = Reminder(title="Water plants", due_at=nine_am_in_london_summer, completed_at=nine_am_in_london_summer, repeats=Repeat.DAILY)

    next_reminder = reminder.create_next_occurrence(ZoneInfo("Europe/London"))

    assert next_reminder.due_at == datetime(2026, 10, 25, 9, 0, tzinfo=UTC)


def test_raises_value_error_when_creating_next_occurrence_of_one_off_reminder() -> None:
    reminder = Reminder(title="Take out bins", due_at=datetime(2026, 11, 10, 19, 0, tzinfo=UTC))

    with pytest.raises(ValueError, match="repeating"):
        reminder.create_next_occurrence(ZoneInfo("Europe/London"))
