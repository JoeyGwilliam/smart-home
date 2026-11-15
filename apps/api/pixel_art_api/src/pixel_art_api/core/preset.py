from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class Preset:
    """ A saved copy of the whole design, every picture, scene and weather as it was at one moment, which can be put
    back at any time. Later changes to the design never change a preset.

    Attributes:
        id:
            Unique identifier. Generated identifiers sort by when the preset was saved.
        name:
            What the preset is called, such as "Winter". Must contain non-whitespace text, and be at most 80
            characters.
        saved_at:
            Timezone-aware time that the preset was saved.

    Raises:
        ValueError: If the name is blank or too long, or saved_at has no time zone.
    """

    id: UUID
    name: str
    saved_at: datetime

    def __post_init__(self) -> None:
        if not self.name.strip() or len(self.name) > 80:
            raise ValueError("A preset's name must contain non-whitespace text, and be at most 80 characters.")
        if self.saved_at.utcoffset() is None:
            raise ValueError("A preset's saved_at must include a time zone.")
