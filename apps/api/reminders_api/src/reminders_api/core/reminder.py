from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid7


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

        for field_name, moment in (("due_at", self.due_at), ("completed_at", self.completed_at)):
            if moment is not None and moment.utcoffset() is None:
                raise ValueError(f"A reminder's {field_name} must include a time zone.")
