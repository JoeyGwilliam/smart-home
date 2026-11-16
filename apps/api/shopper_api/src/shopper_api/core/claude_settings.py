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
    """ How hard Claude thinks before it acts. More effort is slower and costs more, and suits harder shops. """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTRA_HIGH = "xhigh"
    MAX = "max"


@dataclass(frozen=True)
class ClaudeSettings:
    """ How Claude should shop.

    Attributes:
        model:
            The model that does the shopping.
        effort:
            How hard the model thinks.
    """

    model: ClaudeModel = ClaudeModel.SONNET
    effort: ClaudeEffort = ClaudeEffort.MEDIUM
