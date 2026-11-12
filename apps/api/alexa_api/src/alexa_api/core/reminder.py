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
            Timezone-aware due time, or None if there is no due time. For an all-day reminder, the start of the day it
            is due.
        is_all_day:
            Whether the reminder is due at any time on the day of due_at, rather than at a particular time. Only a
            reminder with a due time can be all day.
        completed_at:
            Timezone-aware completion time, or None if not completed.
        repeats:
            How often the reminder comes round again, such as "weekly", or None if it happens once. The skill never
            changes it, but has to send it back when saving. The reminders API creates the next occurrence when a
            repeating reminder is completed.
        assigned_to:
            The name of the person the reminder is for, such as "Joey", or None if it is for nobody in particular.
            The skill never changes it on an existing reminder, but has to send it back when saving.
    """

    id: str
    title: str
    notes: str | None = None
    due_at: datetime | None = None
    is_all_day: bool = False
    completed_at: datetime | None = None
    repeats: str | None = None
    assigned_to: str | None = None
