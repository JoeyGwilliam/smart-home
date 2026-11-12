from dataclasses import asdict
from datetime import UTC
from typing import Annotated, Self
from uuid import UUID, uuid7

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from reminders_api.core.assignee import Assignee
from reminders_api.core.reminder import Reminder
from reminders_api.core.repeat import Repeat

# Converting on the way in means that every response gives the same instant in the same form, including the response
# to the request that saved it.
_UtcDatetime = Annotated[AwareDatetime, AfterValidator(lambda date: date.astimezone(UTC))]


class ReminderSchema(BaseModel):
    """ The JSON representation of a reminder, used for both requests and responses.

    Attributes:
        title:
            Short description of the reminder. Must contain non-whitespace text.
        notes:
            Optional longer details.
        due_at:
            Due time, or None if there is no due time. Must include a time zone in a request, and is always UTC in a
            response. For an all-day reminder, the start of the day it is due, in the home's time zone.
        is_all_day:
            Whether the reminder is due at any time on its due day, rather than at a particular time. Only a reminder
            with a due time can be all day.
        completed_at:
            Completion time, or None if not completed. Must include a time zone in a request, and is always UTC in a
            response.
        repeats:
            How often the reminder comes round again once it is completed, such as "weekly", or None if it only
            happens once. Only a reminder with a due time can repeat.
        assigned_to:
            The person the reminder is for, either "Joey" or "Georgie", or None if it is for nobody in particular.
        id:
            Unique identifier that stays the same when the reminder is edited. Ignored in a request, so that clients
            can send back a reminder that they received.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    title: str
    notes: str | None = None
    due_at: _UtcDatetime | None = None
    is_all_day: bool = False
    completed_at: _UtcDatetime | None = None
    repeats: Repeat | None = None
    assigned_to: Assignee | None = None
    id: UUID = Field(default_factory=uuid7)

    @model_validator(mode="after")
    def _apply_reminder_rules(self) -> Self:
        # Reminder owns the rules for a valid reminder. A ValueError raised here becomes a 422 response.
        self.to_reminder(self.id)
        return self

    @classmethod
    def from_reminder(cls, reminder: Reminder) -> Self:
        """ Creates the JSON representation of a reminder.

        Args:
            reminder:
                The reminder to represent.

        Returns:
            The representation, with the reminder's id and all datetimes in UTC.
        """
        return cls(**asdict(reminder))

    def to_reminder(self, reminder_id: UUID) -> Reminder:
        """ Converts this representation to a reminder.

        Args:
            reminder_id:
                The id of the new reminder, which replaces any id in this representation.

        Returns:
            The reminder.
        """
        return Reminder(**self.model_dump(exclude={"id"}), id=reminder_id)
