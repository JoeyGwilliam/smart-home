import re
from collections.abc import Mapping
from dataclasses import dataclass

# The most pixels a frame may have along either side: enough for a detailed sky behind a whole scene.
MAX_SIDE_PIXELS = 128
# Enough variants for every pose or colour of a picture, and enough frames for a smooth loop, while keeping a picture
# small enough to send to every screen.
MAX_VARIANTS = 32
MAX_FRAMES = 64

TRANSPARENT = "."

# A colour as the site's pages write it: "#rrggbb", "#rrggbbaa" for a see-through one, or one of the colours that the
# site changes with the scene, such as "var(--cloud)". Nothing else is allowed, as each colour ends up in the pages'
# styles.
_COLOUR_PATTERN = re.compile(r"#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|var\(--[a-z0-9-]+\)")


@dataclass(frozen=True)
class PictureFrame:
    """ One drawing in a variant's strip of frames, and how long it shows.

    Attributes:
        rows:
            The pixels, top row first. Each character is one pixel: either "." for a transparent pixel, or a key of the
            variant's palette. Every row has the same number of pixels, and there are between 1 and MAX_SIDE_PIXELS
            rows and columns.
        milliseconds:
            How long the frame shows before the next one, between 20 and 60000. A variant with one frame ignores it.

    Raises:
        ValueError: If the frame is empty or too big, its rows differ in length, or its time is out of range.
    """

    rows: tuple[str, ...]
    milliseconds: int = 200

    def __post_init__(self) -> None:
        if not 1 <= len(self.rows) <= MAX_SIDE_PIXELS:
            raise ValueError(f"A frame must have between 1 and {MAX_SIDE_PIXELS} rows.")
        width = len(self.rows[0])
        if not 1 <= width <= MAX_SIDE_PIXELS:
            raise ValueError(f"A frame's rows must each have between 1 and {MAX_SIDE_PIXELS} pixels.")
        if any(len(row) != width for row in self.rows):
            raise ValueError("A frame's rows must all have the same number of pixels.")
        if not 20 <= self.milliseconds <= 60_000:
            raise ValueError("A frame must show for between 20 and 60000 milliseconds.")


@dataclass(frozen=True)
class PictureVariant:
    """ One way a picture can look, such as a cow that is sleeping or an umbrella that is blue: a strip of frames that
    show one after another, over and over, in the colours of one palette. A still variant has a single frame.

    Attributes:
        name:
            Tells the variant apart from the picture's others, such as "Sleeping". Must contain non-whitespace text,
            and be at most 40 characters.
        palette:
            The colour that each character in the frames stands for, such as {"w": "#fff8e7"}. Each key is a single
            character other than "."; each colour is "#rrggbb", "#rrggbbaa", or a scene colour such as "var(--cloud)".
        frames:
            The drawings, in the order they show. There are between 1 and MAX_FRAMES, all the same size, and every
            pixel in them is transparent or a key of the palette.

    Raises:
        ValueError: If any of those rules is broken.
    """

    name: str
    palette: Mapping[str, str]
    frames: tuple[PictureFrame, ...]

    def __post_init__(self) -> None:
        if not self.name.strip() or len(self.name) > 40:
            raise ValueError("A variant's name must contain non-whitespace text, and be at most 40 characters.")
        if not 1 <= len(self.frames) <= MAX_FRAMES:
            raise ValueError(f"A variant must have between 1 and {MAX_FRAMES} frames.")
        if len({(len(frame.rows), len(frame.rows[0])) for frame in self.frames}) != 1:
            raise ValueError("A variant's frames must all be the same size.")

        for key, colour in self.palette.items():
            if len(key) != 1 or key == TRANSPARENT:
                raise ValueError(f'Each key of a palette must be a single character other than "{TRANSPARENT}".')
            if not _COLOUR_PATTERN.fullmatch(colour):
                raise ValueError(f"{colour!r} is not a colour that a picture can use.")

        used_characters = {character for frame in self.frames for row in frame.rows for character in row} - {TRANSPARENT}
        if not used_characters <= self.palette.keys():
            raise ValueError("Every pixel of a frame must be transparent or have a colour in its variant's palette.")


@dataclass(frozen=True)
class Picture:
    """ Something that scenes are made of, such as a cow, an umbrella or the rain, in every way it can look: either a
    redrawing of one of the site's own pictures, or a new picture of one's own, which has a title.

    Attributes:
        variants:
            The ways the picture can look. There are between 1 and MAX_VARIANTS, with different names. The first is the
            one a placement shows unless it asks for another.
        title:
            What a new picture of one's own is, such as "Castle", or None for a redrawing of one of the site's own
            pictures, which the site names. Must contain non-whitespace text, and be at most 80 characters.

    Raises:
        ValueError: If any of those rules is broken.
    """

    variants: tuple[PictureVariant, ...]
    title: str | None = None

    def __post_init__(self) -> None:
        if self.title is not None and (not self.title.strip() or len(self.title) > 80):
            raise ValueError("A picture's title must contain non-whitespace text, and be at most 80 characters.")
        if not 1 <= len(self.variants) <= MAX_VARIANTS:
            raise ValueError(f"A picture must have between 1 and {MAX_VARIANTS} variants.")
        if len({variant.name for variant in self.variants}) != len(self.variants):
            raise ValueError("A picture's variants must all have different names.")
