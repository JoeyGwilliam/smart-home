from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import URL, DateTime, Dialect, Engine, create_engine, delete, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.types import TypeDecorator

from .reminder import Reminder
from .repeat import Repeat


class ReminderStore:
    """ A store of reminders in a SQLite database. """

    def __init__(self, database_path: Path) -> None:
        """ Connects to a reminder database, creating the file and its table if they don't exist.

        Args:
            database_path:
                Location of the SQLite database file. Its directory must exist.

        Raises:
            sqlalchemy.exc.OperationalError: If the database file cannot be opened.
        """
        # Create a model of the SQL database, with the SQLAlchemy tables
        url = URL.create("sqlite", database=str(database_path))
        engine = create_engine(url, poolclass=NullPool)
        _ReminderDBBase.metadata.create_all(engine)
        _add_columns_missing_from_older_databases(engine)

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


def _add_columns_missing_from_older_databases(engine: Engine) -> None:
    # create_all only creates tables that don't exist, so a database made before reminders could repeat lacks the
    # column. Every existing reminder happens once, which is what an empty column means.
    column_names = {column["name"] for column in inspect(engine).get_columns(_ReminderRow.__tablename__)}
    if "repeats" not in column_names:
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {_ReminderRow.__tablename__} ADD COLUMN repeats VARCHAR"))


class _UtcDateTime(TypeDecorator[datetime]):
    """ A timezone-aware datetime, stored as naive UTC because SQLite cannot store time zones."""
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.astimezone(UTC).replace(tzinfo=None) if value else None

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value else None


class _ReminderDBBase(DeclarativeBase):
    pass


class _ReminderRow(_ReminderDBBase):
    """The database representation of a Reminder."""
    __tablename__ = "reminders"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    title: Mapped[str]
    notes: Mapped[str | None]
    due_at: Mapped[datetime | None] = mapped_column(_UtcDateTime)
    completed_at: Mapped[datetime | None] = mapped_column(_UtcDateTime)
    repeats: Mapped[str | None]

    def to_reminder(self) -> Reminder:
        return Reminder(
            title=self.title,
            notes=self.notes,
            due_at=self.due_at,
            completed_at=self.completed_at,
            repeats=Repeat(self.repeats) if self.repeats else None,
            id=self.id,
        )
