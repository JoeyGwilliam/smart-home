from dataclasses import dataclass
from enum import StrEnum


class ProgressKind(StrEnum):
    """ What a progress event reports.

    - `ACTIVITY`: a step being taken, such as a search or the trolley being emptied.
    - `REPLY`: something Claude said about what it is doing.
    - `FAILURE`: something that went wrong, which ended the shop.
    """

    ACTIVITY = "activity"
    REPLY = "reply"
    FAILURE = "failure"


@dataclass(frozen=True)
class ProgressEvent:
    """ One thing that happened during a shop, for the person who started it to read.

    Attributes:
        kind:
            What the event reports.
        text:
            The event in words.
    """

    kind: ProgressKind
    text: str
