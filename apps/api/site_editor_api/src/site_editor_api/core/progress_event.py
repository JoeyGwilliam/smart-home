from dataclasses import dataclass
from enum import StrEnum


class ProgressKind(StrEnum):
    """ What a progress event reports.

    - `REQUEST`: something the person asked for.
    - `THINKING`: Claude is thinking.
    - `ACTIVITY`: a step being taken, such as a file being edited or the preview being built.
    - `REPLY`: something Claude said to the person.
    - `FAILURE`: a step that went wrong.
    """

    REQUEST = "request"
    THINKING = "thinking"
    ACTIVITY = "activity"
    REPLY = "reply"
    FAILURE = "failure"


@dataclass(frozen=True)
class ProgressEvent:
    """ One thing that happened while a change to the site was being made, for the person who asked for it to read.

    Attributes:
        kind:
            What the event reports.
        text:
            The event in words: the request, the reply, a description of the step, or what went wrong. For
            `THINKING`, this is Claude's thoughts, and is empty when Claude doesn't share them.
    """

    kind: ProgressKind
    text: str
