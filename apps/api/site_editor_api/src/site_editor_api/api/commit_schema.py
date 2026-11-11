from typing import Self

from pydantic import AwareDatetime, BaseModel

from site_editor_api.core.commit import Commit


class CommitSchema(BaseModel):
    """ The JSON representation of a saved change in the site's history.

    Attributes:
        hash:
            The full hash that identifies the commit.
        subject:
            The first line of the commit's message.
        author:
            The name of whoever made the change.
        committed_at:
            When the commit was made, with its time zone.
    """

    hash: str
    subject: str
    author: str
    committed_at: AwareDatetime

    @classmethod
    def from_commit(cls, commit: Commit) -> Self:
        """ Creates the JSON representation of a commit.

        Args:
            commit:
                The commit to represent.

        Returns:
            The representation.
        """
        return cls(hash=commit.hash, subject=commit.subject, author=commit.author, committed_at=commit.committed_at)
