import os
from dataclasses import replace
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid7
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status

from reminders_api.api.reminder_schema import ReminderSchema
from reminders_api.core.reminder_store import ReminderStore


def create_app(database_path: Path, home_time_zone: ZoneInfo) -> FastAPI:
    """ Creates the reminders API, backed by a single database.

    Args:
        database_path:
            Location of the SQLite database file, which is created if it doesn't exist. Its directory must exist.
        home_time_zone:
            The time zone whose clocks repeating reminders follow, so that one due at 09:00 stays due at 09:00 when
            the clocks change.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Reminders API")
    app.state.reminder_store = ReminderStore(database_path)
    app.state.home_time_zone = home_time_zone
    app.include_router(_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the reminders API, configured by environment variables.

    The variables are:

    - `REMINDERS_DATABASE_PATH`: the location of the SQLite database file.
    - `HOME_TIME_ZONE`: the time zone whose clocks repeating reminders follow, such as `Europe/London`.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If a variable is not set. There are deliberately no defaults, so that a configuration mistake stops
            the server rather than silently creating a new, empty database or moving reminders by an hour.
        ZoneInfoNotFoundError: If the time zone doesn't exist.
    """
    return create_app(Path(os.environ["REMINDERS_DATABASE_PATH"]), ZoneInfo(os.environ["HOME_TIME_ZONE"]))


def _get_store(request: Request) -> ReminderStore:
    return request.app.state.reminder_store


def _get_home_time_zone(request: Request) -> ZoneInfo:
    return request.app.state.home_time_zone


_StoreDependency = Annotated[ReminderStore, Depends(_get_store)]
_HomeTimeZoneDependency = Annotated[ZoneInfo, Depends(_get_home_time_zone)]

_router = APIRouter(prefix="/reminders", tags=["reminders"])


@_router.post("", status_code=status.HTTP_201_CREATED)
def create_reminder(reminder_schema: ReminderSchema, store: _StoreDependency) -> ReminderSchema:
    reminder = reminder_schema.to_reminder(uuid7())
    store.save(reminder)
    return ReminderSchema.from_reminder(reminder)


@_router.get("")
def list_reminders(store: _StoreDependency) -> list[ReminderSchema]:
    return [ReminderSchema.from_reminder(reminder) for reminder in store.list_all()]


@_router.get("/{reminder_id}")
def get_reminder(reminder_id: UUID, store: _StoreDependency) -> ReminderSchema:
    reminder = store.get(reminder_id)
    if reminder is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No reminder has the id {reminder_id}.")
    return ReminderSchema.from_reminder(reminder)


@_router.put("/{reminder_id}")
def save_reminder(
    reminder_id: UUID,
    reminder_schema: ReminderSchema,
    store: _StoreDependency,
    home_time_zone: _HomeTimeZoneDependency,
) -> ReminderSchema:
    """ Replaces a reminder. Ticking off a repeating reminder also creates the next one, the way every client expects.

    The completed reminder stops repeating, since the new one carries the repeat on. Unticking it later therefore
    brings back that one occurrence rather than starting a second series.
    """
    reminder = reminder_schema.to_reminder(reminder_id)
    previous_reminder = store.get(reminder_id)
    is_newly_completed = reminder.completed_at is not None and (previous_reminder is None or previous_reminder.completed_at is None)

    if reminder.repeats is not None and is_newly_completed:
        store.save(reminder.create_next_occurrence(home_time_zone))
        reminder = replace(reminder, repeats=None)

    store.save(reminder)
    return ReminderSchema.from_reminder(reminder)


@_router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: UUID, store: _StoreDependency) -> None:
    store.delete(reminder_id)
