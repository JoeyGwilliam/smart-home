from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Reminder:
    """ A reminder held by the reminders API.

    To edit a reminder, make a copy with `dataclasses.replace`, which keeps its id, and save the copy.

    Attributes:
        id:
            The reminders API's identifier for the reminder.
        title:
            Short description of the reminder.
        notes:
            Optional longer details. The skill never changes them, but has to send them back when saving.
        due_at:
            Timezone-aware due time, or None if there is no due time.
        completed_at:
            Timezone-aware completion time, or None if not completed.
    """

    id: str
    title: str
    notes: str | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None
