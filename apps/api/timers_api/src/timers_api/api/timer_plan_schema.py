from dataclasses import asdict
from datetime import time
from typing import Self
from uuid import UUID, uuid7

from pydantic import BaseModel, ConfigDict, Field, model_validator

from timers_api.core.timer_plan import TimerPlan, TimerTask


class TimerTaskSchema(BaseModel):
    """ The JSON representation of one task of a timer plan.

    Attributes:
        name:
            What to do. May be blank.
        duration_minutes:
            How long the task takes when nobody faffs, in whole minutes. Must be at least 1.
        id:
            Tells the task apart from the others in its plan. Clients choose it when they create a task, and send it
            back unchanged from then on. Generated if it is left out.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    name: str
    duration_minutes: int
    id: UUID = Field(default_factory=uuid7)


class TimerPlanSchema(BaseModel):
    """ The JSON representation of a timer plan, used for both requests and responses.

    Attributes:
        name:
            What the plan is for. May be blank.
        end_time:
            The time of day to be ready by, such as "17:00:00". Must not include a time zone.
        tasks:
            The tasks to do, first to last. Their ids must all be different.
        faff_multiplier:
            How many times longer every task really takes than its duration says. Must be at least 1.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    name: str
    end_time: time
    tasks: list[TimerTaskSchema] = []
    faff_multiplier: float = 1.0

    @model_validator(mode="after")
    def _apply_plan_rules(self) -> Self:
        # TimerPlan and TimerTask own the rules for a valid plan. A ValueError raised here becomes a 422 response.
        self.to_plan()
        return self

    @classmethod
    def from_plan(cls, plan: TimerPlan) -> Self:
        """ Creates the JSON representation of a timer plan.

        Args:
            plan:
                The plan to represent.

        Returns:
            The representation.
        """
        return cls(**asdict(plan))

    def to_plan(self) -> TimerPlan:
        """ Converts this representation to a timer plan.

        Returns:
            The plan.
        """
        return TimerPlan(
            name=self.name,
            end_time=self.end_time,
            tasks=tuple(TimerTask(**task_schema.model_dump()) for task_schema in self.tasks),
            faff_multiplier=self.faff_multiplier,
        )
