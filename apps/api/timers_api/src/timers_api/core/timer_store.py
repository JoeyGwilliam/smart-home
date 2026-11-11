from datetime import UTC, datetime, time
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, URL, DateTime, Dialect, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.types import TypeDecorator

from .active_timer import ActiveTimer
from .timer_plan import TimerPlan, TimerTask
from .timer_preset import TimerPreset

# The plan that the active timer holds until someone changes it.
_EMPTY_PLAN = TimerPlan(name="", end_time=time(17, 0))


class TimerStore:
    """ A store of the timer presets and the active timer, in a SQLite database. """

    def __init__(self, database_path: Path) -> None:
        """ Connects to a timer database, creating the file and its tables if they don't exist.

        Args:
            database_path:
                Location of the SQLite database file. Its directory must exist.

        Raises:
            sqlalchemy.exc.OperationalError: If the database file cannot be opened.
        """
        url = URL.create("sqlite", database=str(database_path))
        engine = create_engine(url, poolclass=NullPool)
        _TimerDBBase.metadata.create_all(engine)

        self._begin_session = sessionmaker(engine).begin

    def save_preset(self, preset: TimerPreset) -> None:
        """ Stores a preset, replacing any existing preset with the same id.

        Args:
            preset:
                The preset to store.
        """
        with self._begin_session() as session:
            session.merge(_TimerPresetRow(id=preset.id, **_convert_plan_to_columns(preset.plan)))

    def get_preset(self, preset_id: UUID) -> TimerPreset | None:
        """ Finds a single preset.

        Args:
            preset_id:
                Identifier of the preset to find.

        Returns:
            The matching preset, or None if there isn't one.
        """
        with self._begin_session() as session:
            row = session.get(_TimerPresetRow, preset_id)
            return row.to_preset() if row else None

    def list_presets(self) -> list[TimerPreset]:
        """ Lists every stored preset.

        Returns:
            All presets, sorted by id. Presets with generated ids are therefore oldest first.
        """
        with self._begin_session() as session:
            rows = session.scalars(select(_TimerPresetRow).order_by(_TimerPresetRow.id))
            return [row.to_preset() for row in rows]

    def delete_preset(self, preset_id: UUID) -> None:
        """ Ensures that a preset is no longer stored. Does nothing if it doesn't exist.

        Args:
            preset_id:
                Identifier of the preset to delete.
        """
        with self._begin_session() as session:
            session.execute(delete(_TimerPresetRow).where(_TimerPresetRow.id == preset_id))

    def save_active_timer(self, active_timer: ActiveTimer) -> None:
        """ Replaces the active timer.

        Args:
            active_timer:
                The active timer as it should now be.
        """
        with self._begin_session() as session:
            columns = _convert_plan_to_columns(active_timer.plan)
            session.merge(_ActiveTimerRow(id=_ActiveTimerRow.ONLY_ID, started_at=active_timer.started_at, **columns))

    def get_active_timer(self) -> ActiveTimer:
        """ Finds the active timer. There is always exactly one.

        Returns:
            The active timer as it was last saved. Until one has been saved, it is stopped and has a plan with no name
            and no tasks, which ends at 17:00.
        """
        with self._begin_session() as session:
            row = session.get(_ActiveTimerRow, _ActiveTimerRow.ONLY_ID)
            return ActiveTimer(plan=row.to_plan(), started_at=row.started_at) if row else ActiveTimer(plan=_EMPTY_PLAN)


class _UtcDateTime(TypeDecorator[datetime]):
    """ A timezone-aware datetime, stored as naive UTC because SQLite cannot store time zones. """
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.astimezone(UTC).replace(tzinfo=None) if value else None

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value else None


class _TimerDBBase(DeclarativeBase):
    pass


class _PlanColumns:
    """ The database representation of a TimerPlan, for every table whose rows hold one. """

    name: Mapped[str]
    end_time: Mapped[time]
    faff_multiplier: Mapped[float]
    # A plan's tasks are only ever read and replaced together with the plan, in order, so they are kept inside its
    # row, as a list of each task's fields, rather than in a table of their own.
    tasks: Mapped[list[dict[str, str | int]]] = mapped_column(JSON)

    def to_plan(self) -> TimerPlan:
        tasks = tuple(
            TimerTask(name=task_fields["name"], duration_minutes=task_fields["duration_minutes"], id=UUID(task_fields["id"]))
            for task_fields in self.tasks
        )
        return TimerPlan(name=self.name, end_time=self.end_time, tasks=tasks, faff_multiplier=self.faff_multiplier)


def _convert_plan_to_columns(plan: TimerPlan) -> dict[str, Any]:
    """ Converts a plan to the values of the columns that _PlanColumns defines, keyed by column name. """
    return {
        "name": plan.name,
        "end_time": plan.end_time,
        "faff_multiplier": plan.faff_multiplier,
        "tasks": [
            {"name": task.name, "duration_minutes": task.duration_minutes, "id": str(task.id)}
            for task in plan.tasks
        ],
    }


class _TimerPresetRow(_PlanColumns, _TimerDBBase):
    """ The database representation of a TimerPreset. """
    __tablename__ = "timer_presets"

    id: Mapped[UUID] = mapped_column(primary_key=True)

    def to_preset(self) -> TimerPreset:
        return TimerPreset(plan=self.to_plan(), id=self.id)


class _ActiveTimerRow(_PlanColumns, _TimerDBBase):
    """ The database representation of the ActiveTimer. Its table never holds more than one row. """
    __tablename__ = "active_timer"

    # Every save uses this id, so that each one replaces the row that the last one wrote.
    ONLY_ID = 1

    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[datetime | None] = mapped_column(_UtcDateTime)
