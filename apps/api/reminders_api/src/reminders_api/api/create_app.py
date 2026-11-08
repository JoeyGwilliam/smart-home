import os
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid7

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status

from reminders_api.api.reminder_schema import ReminderSchema
from reminders_api.core.reminder_store import ReminderStore


def create_app(database_path: Path) -> FastAPI:
    """ Creates the reminders API, backed by a single database.

    Args:
        database_path:
            Location of the SQLite database file, which is created if it doesn't exist. Its directory must exist.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Reminders API")
    app.state.reminder_store = ReminderStore(database_path)
    app.include_router(_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the reminders API, using the database named by the `REMINDERS_DATABASE_PATH` environment variable.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If the environment variable is not set. There is deliberately no default, so that a configuration
            mistake stops the server rather than silently creating a new, empty database.
    """
    return create_app(Path(os.environ["REMINDERS_DATABASE_PATH"]))


def _get_store(request: Request) -> ReminderStore:
    return request.app.state.reminder_store


_StoreDependency = Annotated[ReminderStore, Depends(_get_store)]

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
def save_reminder(reminder_id: UUID, reminder_schema: ReminderSchema, store: _StoreDependency) -> ReminderSchema:
    reminder = reminder_schema.to_reminder(reminder_id)
    store.save(reminder)
    return ReminderSchema.from_reminder(reminder)


@_router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: UUID, store: _StoreDependency) -> None:
    store.delete(reminder_id)
