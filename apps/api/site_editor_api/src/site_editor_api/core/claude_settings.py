from dataclasses import dataclass
from enum import StrEnum


class ClaudeModel(StrEnum):
    """ A Claude model, by the name that Claude Code gives to the latest version of it. Later ones are quicker and
    cheaper, and less capable. """

    FABLE = "fable"
    OPUS = "opus"
    SONNET = "sonnet"
    HAIKU = "haiku"


class ClaudeEffort(StrEnum):
    """ How hard Claude thinks before it acts. More effort is slower, and suits harder requests. """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTRA_HIGH = "xhigh"
    MAX = "max"


@dataclass(frozen=True)
class ClaudeSettings:
    """ How Claude should work on a message.

    Attributes:
        model:
            The model that does the work, or None for the one that Claude Code uses by default on this machine.
        effort:
            How hard the model thinks, or None for the model's default.
    """

    model: ClaudeModel | None = None
    effort: ClaudeEffort | None = None
