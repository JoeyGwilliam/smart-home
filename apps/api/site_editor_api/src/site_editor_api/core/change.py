from dataclasses import dataclass
from enum import StrEnum

from .progress_event import ProgressEvent


class ChangeState(StrEnum):
    """ Where the change to the site has got to, which decides what the person can do next.

    - `IDLE`: no change is being made. A message starts one.
    - `WORKING`: Claude is working on the last message. It can be stopped.
    - `BUILDING`: the site is being rebuilt, to preview the change or to remove a discarded one.
    - `DISCUSSING`: Claude has answered, and there is no preview to judge: either no files have changed, or the
      preview could not be built. A message carries the conversation on, and discarding ends it.
    - `REVIEWING`: the running site shows the change, which is not yet saved. It can be confirmed, discarded, or
      refined with another message.
    - `SAVING`: the confirmed change is being committed.
    """

    IDLE = "idle"
    WORKING = "working"
    BUILDING = "building"
    DISCUSSING = "discussing"
    REVIEWING = "reviewing"
    SAVING = "saving"


@dataclass(frozen=True)
class Change:
    """ The change to the site that is being made, as it stands at one moment.

    Attributes:
        state:
            Where the change has got to.
        events:
            Everything that has happened in the conversation about the change, oldest first. Once a change is
            confirmed or discarded, its events stay until the next change is started.
        changed_files:
            The files that differ from the last commit, as paths relative to the repository's root, as of when
            Claude last finished working.
    """

    state: ChangeState
    events: tuple[ProgressEvent, ...]
    changed_files: tuple[str, ...]
