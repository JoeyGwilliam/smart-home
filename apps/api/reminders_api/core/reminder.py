from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid7

from sqlalchemy import URL, DateTime, Dialect, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.types import TypeDecorator


@dataclass(frozen=True)
class Reminder:
    """A reminder, identified from the moment it is created.

    To edit a reminder, make a copy with `dataclasses.replace`, which keeps its id, and save the copy.

    Attributes:
        title:
            Short description of the reminder. Must contain non-whitespace text.
        notes:
            Optional longer details.
        due_at:
            Timezone-aware due time, or None if there is no due time.
        completed_at:
            Timezone-aware completion time, or None if not completed.
        id:
            Unique identifier that stays the same when the reminder is edited. Generated identifiers sort by
            creation time.

    Raises:
        ValueError: If the title is blank, or if due_at or completed_at has no time zone.
    """

    title: str
    notes: str | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None
    id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        if not self.title.strip():
            raise ValueError("A reminder's title must not be blank.")


class ReminderStore:
    """Durable reminder storage, which can be used from multiple threads.

    Datetimes come back as the same instants they were saved with, expressed in UTC.
    """

    def __init__(self, database_path: Path) -> None:
        """Opens the reminder database, creating it and any missing parent directories if needed.

        Args:
            database_path:
                Location of the SQLite database file.
        """
        database_path.parent.mkdir(parents=True, exist_ok=True)

        # SQLite connections are cheap to open. Not pooling them means that there is no close() for callers to
        # remember, and no open connection keeping the database file locked on Windows.
        engine = create_engine(URL.create("sqlite", database=str(database_path)), poolclass=NullPool)

        # TACTICAL HACK: create_all() adds missing tables but never alters existing ones, so changing a column
        # would leave existing databases out of date. The proper solution is Alembic migrations.
        _Base.metadata.create_all(engine)

        self._begin_session = sessionmaker(engine).begin

    def save(self, reminder: Reminder) -> None:
        """Stores a reminder, replacing any existing reminder with the same id.

        Args:
            reminder:
                The reminder to store.
        """
        with self._begin_session() as session:
            session.merge(_ReminderRow(**asdict(reminder)))

    def get(self, reminder_id: UUID) -> Reminder | None:
        """Finds a single reminder.

        Args:
            reminder_id:
                Identifier of the reminder to find.

        Returns:
            The matching reminder, or None if there isn't one.
        """
        with self._begin_session() as session:
            row = session.get(_ReminderRow, reminder_id)
            return _convert_row_to_reminder(row) if row else None

    def list_all(self) -> list[Reminder]:
        """Lists every stored reminder.

        Returns:
            All reminders, sorted by id. Reminders with generated ids are therefore oldest first.
        """
        with self._begin_session() as session:
            rows = session.scalars(select(_ReminderRow).order_by(_ReminderRow.id))
            return [_convert_row_to_reminder(row) for row in rows]

    def delete(self, reminder_id: UUID) -> None:
        """Ensures that a reminder is no longer stored. Does nothing if it doesn't exist.

        Args:
            reminder_id:
                Identifier of the reminder to delete.
        """
        with self._begin_session() as session:
            session.execute(delete(_ReminderRow).where(_ReminderRow.id == reminder_id))


class _UtcDateTime(TypeDecorator[datetime]):
    """A timezone-aware datetime, stored as naive UTC because SQLite cannot store time zones."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.astimezone(UTC).replace(tzinfo=None) if value else None

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value else None


class _Base(DeclarativeBase):
    pass


class _ReminderRow(_Base):
    """The database representation of a Reminder."""

    __tablename__ = "reminders"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    title: Mapped[str]
    notes: Mapped[str | None]
    due_at: Mapped[datetime | None] = mapped_column(_UtcDateTime)
    completed_at: Mapped[datetime | None] = mapped_column(_UtcDateTime)


def _convert_row_to_reminder(row: _ReminderRow) -> Reminder:
    return Reminder(
        title=row.title,
        notes=row.notes,
        due_at=row.due_at,
        completed_at=row.completed_at,
        id=row.id,
    )
