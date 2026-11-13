from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Reminder:
    """ The parts of a reminder held by the reminders API that the skill uses. The API holds more, such as notes and
    repeats, which the skill never needs to know about: it changes a reminder by naming only what changes.

    Attributes:
        id:
            The reminders API's identifier for the reminder.
        title:
            Short description of the reminder.
        due_at:
            Timezone-aware due time, or None if there is no due time. For an all-day reminder, the start of the day it
            is due.
        is_all_day:
            Whether the reminder is due at any time on the day of due_at, rather than at a particular time. Only a
            reminder with a due time can be all day.
    """

    id: str
    title: str
    due_at: datetime | None = None
    is_all_day: bool = False
