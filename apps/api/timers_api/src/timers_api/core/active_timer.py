from dataclasses import dataclass
from datetime import datetime

from .timer_plan import TimerPlan


@dataclass(frozen=True)
class ActiveTimer:
    """ The one timer that every screen in the home shows: the plan being worked on, and whether it has been started.

    Attributes:
        plan:
            The plan being worked on.
        started_at:
            Timezone-aware time that the timer was started, or None while it is stopped.

    Raises:
        ValueError: If started_at has no time zone.
    """

    plan: TimerPlan
    started_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.started_at is not None and self.started_at.utcoffset() is None:
            raise ValueError("An active timer's started_at must include a time zone.")
