import math
from dataclasses import dataclass, field
from datetime import time
from uuid import UUID, uuid7


@dataclass(frozen=True)
class TimerTask:
    """ One step of getting ready, such as "Doing makeup".

    Attributes:
        name:
            What to do. May be blank while the task is still being written.
        duration_minutes:
            How long the task takes when nobody faffs, in minutes. Must be at least 1.
        id:
            Tells the task apart from the others in its plan, and stays the same when the task is edited or moved.

    Raises:
        ValueError: If the duration is less than a minute.
    """

    name: str
    duration_minutes: int
    id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        if self.duration_minutes < 1:
            raise ValueError("A task's duration_minutes must be at least 1.")


@dataclass(frozen=True)
class TimerPlan:
    """ A time to be ready by, and the tasks that lead up to it.

    The tasks happen one after another and the last one finishes at the end time, so the time to start each task
    follows from the end time, the durations and the faff multiplier.

    Attributes:
        name:
            What the plan is for, such as "School run". May be blank while the plan hasn't been named.
        end_time:
            The time of day to be ready by, on the clock of wherever the timer is used. Must not have a time zone.
        tasks:
            The tasks to do, first to last. Their ids must all be different.
        faff_multiplier:
            How many times longer every task really takes than its duration says. Must be a finite number that is at
            least 1.

    Raises:
        ValueError: If end_time has a time zone, if two tasks share an id, or if faff_multiplier is not a finite
            number that is at least 1.
    """

    name: str
    end_time: time
    tasks: tuple[TimerTask, ...] = ()
    faff_multiplier: float = 1.0

    def __post_init__(self) -> None:
        if self.end_time.tzinfo is not None:
            raise ValueError("A timer plan's end_time must not include a time zone.")

        if len({task.id for task in self.tasks}) != len(self.tasks):
            raise ValueError("A timer plan's tasks must all have different ids.")

        if not (math.isfinite(self.faff_multiplier) and self.faff_multiplier >= 1):
            raise ValueError("A timer plan's faff_multiplier must be a finite number that is at least 1.")
