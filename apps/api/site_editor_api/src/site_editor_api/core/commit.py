from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Commit:
    """ A saved change in the site's history.

    Attributes:
        hash:
            The full hash that identifies the commit.
        subject:
            The first line of the commit's message.
        author:
            The name of whoever made the change.
        committed_at:
            Timezone-aware time that the commit was made.
    """

    hash: str
    subject: str
    author: str
    committed_at: datetime
