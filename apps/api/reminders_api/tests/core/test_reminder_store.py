import sqlite3
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid7

import pytest
from sqlalchemy.exc import OperationalError

from reminders_api.core.assignee import Assignee
from reminders_api.core.reminder import Reminder
from reminders_api.core.reminder_store import ReminderStore
from reminders_api.core.repeat import Repeat


def test_returns_all_fields_when_getting_saved_reminder(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "reminders.db")
    reminder = Reminder(
        title="Take out bins",
        notes="The blue one",
        due_at=datetime(2026, 11, 8, 9, 30, 15, 123456, tzinfo=UTC),
        completed_at=datetime(2026, 11, 8, 10, 0, tzinfo=UTC),
        repeats=Repeat.WEEKLY,
        assigned_to=Assignee.GEORGIE,
    )

    store.save(reminder)

    assert store.get(reminder.id) == reminder


def test_returns_same_instant_in_utc_when_saved_in_another_time_zone(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "reminders.db")
    nine_am_at_plus_five = datetime(2026, 11, 8, 9, 0, tzinfo=timezone(timedelta(hours=5)))
    reminder = Reminder(title="Take out bins", due_at=nine_am_at_plus_five)

    store.save(reminder)

    loaded_due_at = store.get(reminder.id).due_at
    assert loaded_due_at == nine_am_at_plus_five
    assert loaded_due_at.utcoffset() == timedelta(0)
    assert loaded_due_at.hour == 4


def test_returns_saved_reminder_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "reminders.db"
    reminder = Reminder(title="Take out bins")
    ReminderStore(database_path).save(reminder)

    loaded_reminder = ReminderStore(database_path).get(reminder.id)

    assert loaded_reminder == reminder


def test_replaces_reminder_when_saving_with_existing_id(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "reminders.db")
    reminder = Reminder(title="Take out bins", notes="The blue one", due_at=datetime(2026, 11, 8, tzinfo=UTC))
    store.save(reminder)
    edited_reminder = replace(reminder, title="Take out recycling", notes=None, due_at=None)

    store.save(edited_reminder)

    assert store.list_all() == [edited_reminder]


def test_returns_none_when_getting_missing_reminder(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "reminders.db")

    loaded_reminder = store.get(uuid7())

    assert loaded_reminder is None


def test_returns_empty_list_when_database_is_new(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "new_database.db")

    all_reminders = store.list_all()

    assert all_reminders == []


def test_lists_oldest_reminder_first_when_saved_out_of_order(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "reminders.db")
    oldest_reminder = Reminder(title="Oldest")
    newest_reminder = Reminder(title="Newest")
    store.save(newest_reminder)
    store.save(oldest_reminder)

    all_reminders = store.list_all()

    assert all_reminders == [oldest_reminder, newest_reminder]


def test_removes_only_that_reminder_when_deleting(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "reminders.db")
    reminder_to_delete = Reminder(title="Delete me")
    reminder_to_keep = Reminder(title="Keep me")
    store.save(reminder_to_delete)
    store.save(reminder_to_keep)

    store.delete(reminder_to_delete.id)

    assert store.list_all() == [reminder_to_keep]


def test_does_nothing_when_deleting_missing_reminder(tmp_path: Path) -> None:
    store = ReminderStore(tmp_path / "reminders.db")
    reminder = Reminder(title="Take out bins")
    store.save(reminder)

    store.delete(uuid7())

    assert store.list_all() == [reminder]


def test_raises_operational_error_when_existing_table_is_missing_column(tmp_path: Path) -> None:
    database_path = tmp_path / "unmigrated.db"
    with closing(sqlite3.connect(database_path)) as connection:
        connection.execute("CREATE TABLE reminders (id CHAR(32) PRIMARY KEY, title VARCHAR NOT NULL)")
    store = ReminderStore(database_path)

    with pytest.raises(OperationalError, match="no such column"):
        store.list_all()


def test_loads_existing_reminders_as_one_offs_when_database_predates_repeats(tmp_path: Path) -> None:
    database_path = tmp_path / "before_repeats.db"
    reminder_id = uuid7()
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute(
            "CREATE TABLE reminders (id CHAR(32) PRIMARY KEY, title VARCHAR NOT NULL, notes VARCHAR, due_at DATETIME, "
            "completed_at DATETIME)"
        )
        connection.execute("INSERT INTO reminders (id, title) VALUES (?, 'Take out bins')", (reminder_id.hex,))

    store = ReminderStore(database_path)

    assert store.list_all() == [Reminder(title="Take out bins", id=reminder_id)]


def test_loads_existing_reminders_as_unassigned_when_database_predates_assignees(tmp_path: Path) -> None:
    database_path = tmp_path / "before_assignees.db"
    reminder_id = uuid7()
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute(
            "CREATE TABLE reminders (id CHAR(32) PRIMARY KEY, title VARCHAR NOT NULL, notes VARCHAR, due_at DATETIME, "
            "completed_at DATETIME, repeats VARCHAR)"
        )
        connection.execute("INSERT INTO reminders (id, title) VALUES (?, 'Take out bins')", (reminder_id.hex,))

    store = ReminderStore(database_path)

    assert store.list_all() == [Reminder(title="Take out bins", id=reminder_id)]


def test_raises_operational_error_when_database_directory_does_not_exist(tmp_path: Path) -> None:
    with pytest.raises(OperationalError, match="unable to open database file"):
        ReminderStore(tmp_path / "missing_directory" / "reminders.db")
