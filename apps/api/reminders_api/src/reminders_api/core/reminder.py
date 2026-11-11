from dataclasses import dataclass, field, replace
from datetime import datetime
from itertools import count
from typing import Self
from uuid import UUID, uuid7
from zoneinfo import ZoneInfo

from .assignee import Assignee
from .repeat import Repeat


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
        repeats:
            How often the reminder comes round again once it is completed, or None if it only happens once. Only a
            reminder with a due time can repeat.
        assigned_to:
            The person who the reminder is for, or None if it is for nobody in particular.
        id:
            Unique identifier that stays the same when the reminder is edited. Generated identifiers sort by
            creation time.

    Raises:
        ValueError: If the title is blank, if due_at or completed_at has no time zone, or if the reminder repeats
            without a due time.
    """

    title: str
    notes: str | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None
    repeats: Repeat | None = None
    assigned_to: Assignee | None = None
    id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        if not self.title.strip():
            raise ValueError("A reminder's title must not be blank.")

        for field_name, moment in (("due_at", self.due_at), ("completed_at", self.completed_at)):
            if moment is not None and moment.utcoffset() is None:
                raise ValueError(f"A reminder's {field_name} must include a time zone.")

        if self.repeats is not None and self.due_at is None:
            raise ValueError("A reminder must have a due_at to repeat.")

    def create_next_occurrence(self, home_time_zone: ZoneInfo) -> Self:
        """ Creates the reminder for the next time that this repeating reminder comes round.

        Args:
            home_time_zone:
                The time zone whose clocks the reminder follows, so that one due at 09:00 stays due at 09:00 when the
                clocks change.

        Returns:
            A new, uncompleted reminder with its own id and the same title, notes, repeat and assignee. It is due at the first
            repeat that is after both this reminder's due time and its completion time, so ticking off a reminder that
            has been overdue for several repeats doesn't create one that is already overdue.

        Raises:
            ValueError: If this reminder doesn't repeat.
        """
        if self.repeats is None or self.due_at is None:
            raise ValueError("Only a repeating reminder has a next occurrence.")

        # Counting repeats from the original due time, rather than stepping from each repeat to the next, keeps a
        # monthly reminder due on the 31st from moving to the 28th for good after February.
        local_due_at = self.due_at.astimezone(home_time_zone)
        earliest_due_at = max(self.due_at, self.completed_at or self.due_at)
        next_due_at = next(
            due_at
            for due_at in (self.repeats.advance(local_due_at, repeat_count) for repeat_count in count(1))
            if due_at > earliest_due_at
        )
        return replace(self, due_at=next_due_at, completed_at=None, id=uuid7())
