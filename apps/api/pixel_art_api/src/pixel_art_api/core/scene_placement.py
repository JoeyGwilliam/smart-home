import re
from dataclasses import dataclass
from typing import Literal, get_args

Anchor = Literal["top", "bottom"]
Spread = Literal["none", "across", "tile", "screen"]
Motion = Literal["none", "drift", "hop", "flutter", "wander"]

# The most screen pixels across that one of a picture's pixels may be drawn.
MAX_PIXEL_SIZE = 32

# The same rule as for the ids that pictures are kept under, as a placement names one of them.
_ID_PATTERN = re.compile(r"[a-z0-9-]{1,64}")


@dataclass(frozen=True)
class ScenePlacement:
    """ A picture placed on the screen, in a layer. Placements know nothing of each other: an umbrella
    over a cow is simply two placements, one above the other.

    Attributes:
        id:
            Tells the placement apart from the others in its layer. Lower-case letters, digits and hyphens.
        picture_id:
            The id of the picture to show, such as "cow". The site decides which pictures there are.
        variant:
            The name of the picture's variant to show, such as "Sleeping". The picture's first variant shows if it has
            none of this name. At most 40 characters.
        x:
            How far across the screen the picture's left edge is, as a percentage of the screen's width. Only used when
            the picture isn't spread. Between -50 and 150, so that a picture can start partly off the screen.
        anchor:
            Which edge of the screen `y` counts from: "top" for things in the sky, "bottom" for things on the ground.
        y:
            From the top: how far down the picture's top edge is, as a percentage of the screen's height, between -50
            and 150. From the bottom: how far up the picture's bottom edge is, in screen pixels, between -500 and 2000.
            Not used when the picture is spread over the screen.
        pixel_size:
            How many screen pixels across each of the picture's pixels is drawn. Between 1 and MAX_PIXEL_SIZE. Not used
            when the picture is stretched over the screen.
        spread:
            How the picture covers the screen: "none" for once, "across" for repeated along the width, like the grass,
            "tile" for repeated across and down, like the rain, or "screen" for stretched over all of it, like the sky.
        opacity:
            How solid the picture is, from 0 for invisible to 100 for solid, so that it can be laid over others like a
            veil.
        is_flipped:
            Whether the picture faces the other way.
        motion:
            How the placement moves about, on top of its variant's own frames: "drift" across the sky, "hop" now and
            then, "flutter" in loops, or "wander" a little.

    Raises:
        ValueError: If any attribute breaks the rules above.
    """

    id: str
    picture_id: str
    x: float
    anchor: Anchor
    y: float
    pixel_size: int
    variant: str = ""
    spread: Spread = "none"
    opacity: int = 100
    is_flipped: bool = False
    motion: Motion = "none"

    def __post_init__(self) -> None:
        if not _ID_PATTERN.fullmatch(self.id) or not _ID_PATTERN.fullmatch(self.picture_id):
            raise ValueError("A placement's id and picture_id must be lower-case letters, digits and hyphens.")
        if len(self.variant) > 40:
            raise ValueError("A placement's variant must be at most 40 characters.")
        if self.anchor not in get_args(Anchor) or self.spread not in get_args(Spread) or self.motion not in get_args(Motion):
            raise ValueError("A placement's anchor, spread or motion isn't one that the site knows.")
        if not -50 <= self.x <= 150:
            raise ValueError("A placement's x must be between -50 and 150.")
        y_range = (-50, 150) if self.anchor == "top" else (-500, 2000)
        if not y_range[0] <= self.y <= y_range[1]:
            raise ValueError(f"A placement's y must be between {y_range[0]} and {y_range[1]} from the {self.anchor}.")
        if not 1 <= self.pixel_size <= MAX_PIXEL_SIZE:
            raise ValueError(f"A placement's pixel_size must be between 1 and {MAX_PIXEL_SIZE}.")
        if not 0 <= self.opacity <= 100:
            raise ValueError("A placement's opacity must be between 0 and 100.")
