from dataclasses import dataclass
from datetime import datetime, time


@dataclass(frozen=True)
class TimerTask:
    """ One step of getting ready in the timer's plan, such as "Doing makeup".

    Attributes:
        name:
            What to do. May be blank, if nobody has named the task yet.
        duration_minutes:
            How long the task takes when nobody faffs, in whole minutes. At least 1.
    """

    name: str
    duration_minutes: int


@dataclass(frozen=True)
class ActiveTimer:
    """ The one timer that every screen in the home shows: the plan being worked on, and whether it has been started.

    Attributes:
        name:
            What the plan is for, such as "School run". May be blank, if nobody has named the plan.
        end_time:
            The time of day to be ready by, on the home's clock. Has no time zone.
        tasks:
            The tasks to do one after another, first to last. The last one finishes at the end time.
        faff_multiplier:
            How many times longer every task really takes than its duration says. At least 1.
        started_at:
            Timezone-aware moment that the timer was started, or None while it is stopped.
    """

    name: str
    end_time: time
    tasks: tuple[TimerTask, ...]
    faff_multiplier: float
    started_at: datetime | None
