from dataclasses import dataclass

from .scene_placement import ScenePlacement

# Enough for a busy layer, while keeping one small enough to send to every screen.
MAX_PLACEMENTS = 200


@dataclass(frozen=True)
class LayerDesign:
    """ A named group of placed pictures, such as "Animals by day" or "Rain", which scenes stack up to make the
    backdrop. A layer can be used by any number of scenes, so changing it changes all of them.

    Attributes:
        name:
            What the layer is called. Must contain non-whitespace text, and be at most 80 characters.
        placements:
            The pictures in the layer, each drawn over the ones before it. Their ids must all be different, and there
            may be at most MAX_PLACEMENTS of them.

    Raises:
        ValueError: If the name is blank or too long, two placements share an id, or there are too many placements.
    """

    name: str
    placements: tuple[ScenePlacement, ...] = ()

    def __post_init__(self) -> None:
        if not self.name.strip() or len(self.name) > 80:
            raise ValueError("A layer's name must contain non-whitespace text, and be at most 80 characters.")
        if len({placement.id for placement in self.placements}) != len(self.placements):
            raise ValueError("A layer's placements must all have different ids.")
        if len(self.placements) > MAX_PLACEMENTS:
            raise ValueError(f"A layer may have at most {MAX_PLACEMENTS} placements.")
