from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import URL, DateTime, Dialect, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.types import TypeDecorator

from .reminder import Reminder


class ReminderStore:
    """ A store of reminders. """

    def __init__(self, database_path: Path) -> None:
        """ Opens the reminder database, creating it and any missing parent directories if needed.

        Args:
            database_path:
                Location of the SQLite database file.
        """
        database_path.parent.mkdir(parents=True, exist_ok=True)
        url = URL.create("sqlite", database=str(database_path))
        engine = create_engine(url, poolclass=NullPool)

        # TACTICAL HACK: create_all() adds missing tables but never alters existing ones, so changing a column
        # would leave existing databases out of date. The proper solution is Alembic migrations.
        _Base.metadata.create_all(engine)

        self._begin_session = sessionmaker(engine).begin

    def save(self, reminder: Reminder) -> None:
        """ Stores a reminder, replacing any existing reminder with the same id.

        Args:
            reminder:
                The reminder to store.
        """
        with self._begin_session() as session:
            session.merge(_ReminderRow(**asdict(reminder)))

    def get(self, reminder_id: UUID) -> Reminder | None:
        """ Finds a single reminder.

        Args:
            reminder_id:
                Identifier of the reminder to find.

        Returns:
            The matching reminder, or None if there isn't one.
        """
        with self._begin_session() as session:
            row = session.get(_ReminderRow, reminder_id)
            return row.to_reminder() if row else None

    def list_all(self) -> list[Reminder]:
        """ Lists every stored reminder.

        Returns:
            All reminders, sorted by id. Reminders with generated ids are therefore oldest first.
        """
        with self._begin_session() as session:
            rows = session.scalars(select(_ReminderRow).order_by(_ReminderRow.id))
            return [row.to_reminder() for row in rows]

    def delete(self, reminder_id: UUID) -> None:
        """ Ensures that a reminder is no longer stored. Does nothing if it doesn't exist.

        Args:
            reminder_id:
                Identifier of the reminder to delete.
        """
        with self._begin_session() as session:
            session.execute(delete(_ReminderRow).where(_ReminderRow.id == reminder_id))


class _UtcDateTime(TypeDecorator[datetime]):
    """ A timezone-aware datetime, stored as naive UTC because SQLite cannot store time zones."""

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

    def to_reminder(self) -> Reminder:
        return Reminder(
            title=self.title,
            notes=self.notes,
            due_at=self.due_at,
            completed_at=self.completed_at,
            id=self.id,
        )
