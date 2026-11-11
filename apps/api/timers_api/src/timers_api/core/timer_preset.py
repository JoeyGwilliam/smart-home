from dataclasses import dataclass, field
from uuid import UUID, uuid7

from .timer_plan import TimerPlan


@dataclass(frozen=True)
class TimerPreset:
    """ A plan that has been saved under its name, to be used again.

    To edit a preset, make a copy with `dataclasses.replace`, which keeps its id, and save the copy.

    Attributes:
        plan:
            The saved plan. It and each of its tasks must have a name that contains non-whitespace text, as a preset
            is chosen by its name and its tasks are read aloud by theirs.
        id:
            Unique identifier that stays the same when the preset is edited. Generated identifiers sort by creation
            time.

    Raises:
        ValueError: If the name of the plan or of any of its tasks is blank.
    """

    plan: TimerPlan
    id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        if not self.plan.name.strip():
            raise ValueError("A timer preset's name must not be blank.")

        if any(not task.name.strip() for task in self.plan.tasks):
            raise ValueError("The name of a timer preset's task must not be blank.")
