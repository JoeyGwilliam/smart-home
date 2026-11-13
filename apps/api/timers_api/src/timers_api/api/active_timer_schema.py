from datetime import UTC
from typing import Annotated, Self
from uuid import UUID

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict

from timers_api.api.timer_plan_schema import TimerPlanSchema
from timers_api.core.active_timer import ActiveTimer

# Converting on the way in means that every response gives the same instant in the same form, including the response
# to the request that saved it.
_UtcDatetime = Annotated[AwareDatetime, AfterValidator(lambda date: date.astimezone(UTC))]


class ActiveTimerSchema(BaseModel):
    """ The JSON representation of the active timer, used for both requests and responses.

    Attributes:
        plan:
            The plan being worked on.
        started_at:
            When the timer was started, or None while it is stopped. Must include a time zone in a request, and is
            always UTC in a response.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    plan: TimerPlanSchema
    started_at: _UtcDatetime | None = None

    @classmethod
    def from_active_timer(cls, active_timer: ActiveTimer) -> Self:
        """ Creates the JSON representation of the active timer.

        Args:
            active_timer:
                The active timer to represent.

        Returns:
            The representation, with started_at in UTC.
        """
        return cls(plan=TimerPlanSchema.from_plan(active_timer.plan), started_at=active_timer.started_at)

    def to_active_timer(self) -> ActiveTimer:
        """ Converts this representation to the active timer.

        Returns:
            The active timer.
        """
        return ActiveTimer(plan=self.plan.to_plan(), started_at=self.started_at)


class TimerStartSchema(BaseModel):
    """ The JSON representation of a request to start the active timer.

    Attributes:
        started_at:
            The moment that the timer counts from. Must include a time zone.
        preset_id:
            The preset whose plan the timer takes on, or None to start the plan that the timer already has.
    """
    model_config = ConfigDict(extra="forbid")

    started_at: _UtcDatetime
    preset_id: UUID | None = None
