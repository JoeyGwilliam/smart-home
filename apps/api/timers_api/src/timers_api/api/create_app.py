import os
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid7

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status

from timers_api.api.active_timer_schema import ActiveTimerSchema
from timers_api.api.timer_preset_schema import TimerPresetSchema
from timers_api.core.timer_store import TimerStore


def create_app(database_path: Path) -> FastAPI:
    """ Creates the timers API, backed by a single database.

    Args:
        database_path:
            Location of the SQLite database file, which is created if it doesn't exist. Its directory must exist.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Timers API")
    app.state.timer_store = TimerStore(database_path)
    app.include_router(_presets_router)
    app.include_router(_active_timer_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the timers API, using the database named by the `TIMERS_DATABASE_PATH` environment variable.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If the environment variable is not set. There is deliberately no default, so that a configuration
            mistake stops the server rather than silently creating a new, empty database.
    """
    return create_app(Path(os.environ["TIMERS_DATABASE_PATH"]))


def _get_store(request: Request) -> TimerStore:
    return request.app.state.timer_store


_StoreDependency = Annotated[TimerStore, Depends(_get_store)]

_presets_router = APIRouter(prefix="/presets", tags=["presets"])


@_presets_router.post("", status_code=status.HTTP_201_CREATED)
def create_preset(preset_schema: TimerPresetSchema, store: _StoreDependency) -> TimerPresetSchema:
    preset = preset_schema.to_preset(uuid7())
    store.save_preset(preset)
    return TimerPresetSchema.from_preset(preset)


@_presets_router.get("")
def list_presets(store: _StoreDependency) -> list[TimerPresetSchema]:
    return [TimerPresetSchema.from_preset(preset) for preset in store.list_presets()]


@_presets_router.get("/{preset_id}")
def get_preset(preset_id: UUID, store: _StoreDependency) -> TimerPresetSchema:
    preset = store.get_preset(preset_id)
    if preset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No timer preset has the id {preset_id}.")
    return TimerPresetSchema.from_preset(preset)


@_presets_router.put("/{preset_id}")
def save_preset(preset_id: UUID, preset_schema: TimerPresetSchema, store: _StoreDependency) -> TimerPresetSchema:
    preset = preset_schema.to_preset(preset_id)
    store.save_preset(preset)
    return TimerPresetSchema.from_preset(preset)


@_presets_router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(preset_id: UUID, store: _StoreDependency) -> None:
    store.delete_preset(preset_id)


# The one timer that every screen shows. There is always exactly one, so it can be fetched and replaced, but not
# created or deleted.
_active_timer_router = APIRouter(prefix="/active-timer", tags=["active timer"])


@_active_timer_router.get("")
def get_active_timer(store: _StoreDependency) -> ActiveTimerSchema:
    return ActiveTimerSchema.from_active_timer(store.get_active_timer())


@_active_timer_router.put("")
def save_active_timer(active_timer_schema: ActiveTimerSchema, store: _StoreDependency) -> ActiveTimerSchema:
    active_timer = active_timer_schema.to_active_timer()
    store.save_active_timer(active_timer)
    return ActiveTimerSchema.from_active_timer(active_timer)
