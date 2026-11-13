from dataclasses import dataclass


@dataclass(frozen=True)
class TimerPreset:
    """ A timer plan that has been saved under its name on the site's ADHD timer page.

    Attributes:
        id:
            The timers API's identifier for the preset.
        name:
            What the plan is for, such as "School run", which is how people ask for it.
    """

    id: str
    name: str
