from dataclasses import dataclass
from enum import StrEnum

# How many of the household's latest Morrisons orders Claude learns from, unless asked for another number. Enough to
# show the brands it usually buys, without one unusual shop counting for much.
DEFAULT_PAST_ORDER_COUNT = 5


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
        preferences:
            How the household likes to shop, in its own words, such as "Free-range eggs only", for Claude to follow
            when choosing products. Empty if it has none.
        past_order_count:
            How many of the household's latest Morrisons orders Claude learns from, to choose the products it has
            bought before. Zero for none. Only a logged-in account has orders.
    """

    model: ClaudeModel = ClaudeModel.SONNET
    effort: ClaudeEffort = ClaudeEffort.MEDIUM
    preferences: str = ""
    past_order_count: int = DEFAULT_PAST_ORDER_COUNT
