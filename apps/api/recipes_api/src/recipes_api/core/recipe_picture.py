from dataclasses import dataclass, field
from uuid import UUID, uuid7

# The kinds of image that every browser can show.
PICTURE_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})

# Big enough for a photo straight from a phone's camera.
MAX_PICTURE_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class RecipePicture:
    """ A picture of a dish, as an image file.

    A picture never changes once it has been stored: a recipe is given a different picture by storing a new one.

    Attributes:
        content:
            The image file's bytes. Must not be empty, and must be no more than MAX_PICTURE_BYTES long.
        content_type:
            The image's media type, such as "image/jpeg". Must be one of PICTURE_CONTENT_TYPES.
        id:
            Unique identifier.

    Raises:
        ValueError: If the content is empty or too long, or the content type isn't one of those allowed.
    """

    content: bytes
    content_type: str
    id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        if self.content_type not in PICTURE_CONTENT_TYPES:
            raise ValueError("A recipe's picture must be a JPEG, PNG, WebP or GIF image.")

        if not self.content:
            raise ValueError("A recipe's picture must not be empty.")

        if len(self.content) > MAX_PICTURE_BYTES:
            raise ValueError(f"A recipe's picture must be no bigger than {MAX_PICTURE_BYTES // (1024 * 1024)} MB.")

    def __repr__(self) -> str:
        # The default would print every byte of the image.
        return f"RecipePicture(content=<{len(self.content)} bytes>, content_type={self.content_type!r}, id={self.id!r})"
