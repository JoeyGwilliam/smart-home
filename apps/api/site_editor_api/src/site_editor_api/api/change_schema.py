from typing import Self

from pydantic import BaseModel

from site_editor_api.core.change import Change, ChangeState
from site_editor_api.core.progress_event import ProgressKind


class ProgressEventSchema(BaseModel):
    """ The JSON representation of one thing that happened while a change was being made.

    Attributes:
        kind:
            What the event reports.
        text:
            The event in words. Empty for thinking that Claude didn't share.
    """

    kind: ProgressKind
    text: str


class ChangeSchema(BaseModel):
    """ The JSON representation of the change that is being made to the site.

    Attributes:
        state:
            Where the change has got to.
        events:
            Everything that has happened in the conversation about the change, oldest first.
        changed_files:
            The files that differ from the last commit, as paths relative to the repository's root.
    """

    state: ChangeState
    events: list[ProgressEventSchema]
    changed_files: list[str]

    @classmethod
    def from_change(cls, change: Change) -> Self:
        """ Creates the JSON representation of a change.

        Args:
            change:
                The change to represent.

        Returns:
            The representation.
        """
        return cls(
            state=change.state,
            events=[ProgressEventSchema(kind=event.kind, text=event.text) for event in change.events],
            changed_files=list(change.changed_files),
        )
