from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TimerPreset:
    """ A timer plan that has been saved under its name on the site's ADHD timer page.

    Attributes:
        name:
            What the plan is for, such as "School run", which is how people ask for it.
        plan:
            The plan, exactly as the timers API represents it. The skill never looks inside: it only hands the plan
            back to the timers API to start it.
    """

    name: str
    plan: dict[str, Any]
