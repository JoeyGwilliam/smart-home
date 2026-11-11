from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Reminder:
    """ What the skill needs to know about a reminder held by the reminders API.

    Attributes:
        title:
            Short description of the reminder.
        due_at:
            Timezone-aware due time, or None if there is no due time.
    """

    title: str
    due_at: datetime | None = None
