import re
from dataclasses import dataclass
from typing import Literal, get_args

TimeOfDay = Literal["sunrise", "day", "sunset", "night"]
Weather = Literal["clear", "cloudy", "fog", "drizzle", "rain", "snow", "thunder"]

# More layers than any scene needs, while keeping a scene easy to take in.
MAX_LAYERS = 50

# The same rule as for the ids that layers are kept under, as a scene names them.
_ID_PATTERN = re.compile(r"[a-z0-9-]{1,64}")


@dataclass(frozen=True)
class SceneDesign:
    """ What the backdrop behind every page shows: a stack of layers, and the colours to show them in.

    Attributes:
        name:
            What the scene is called, such as "Christmas". Must contain non-whitespace text, and be at most 80
            characters.
        time_of_day:
            "sunrise", "day", "sunset" or "night", whose colours the scene takes, along with its weather: those of the
            pages over it, and of every colour in it that changes with the sky. At night, the pages are dark.
        weather:
            "clear", "cloudy", "fog", "drizzle", "rain", "snow" or "thunder", whose colours the scene takes.
        layer_ids:
            The ids of the layers in the scene, back first: each is drawn over the ones before it. The ids are all
            different, and there are at most MAX_LAYERS of them. A layer that doesn't exist is left out of the backdrop.

    Raises:
        ValueError: If any of those rules is broken.
    """

    name: str
    time_of_day: TimeOfDay
    weather: Weather
    layer_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.name.strip() or len(self.name) > 80:
            raise ValueError("A scene's name must contain non-whitespace text, and be at most 80 characters.")
        if self.time_of_day not in get_args(TimeOfDay) or self.weather not in get_args(Weather):
            raise ValueError("A scene's time_of_day and weather must be ones that the site knows.")
        if any(not _ID_PATTERN.fullmatch(layer_id) for layer_id in self.layer_ids):
            raise ValueError("A scene's layer ids must be lower-case letters, digits and hyphens.")
        if len(set(self.layer_ids)) != len(self.layer_ids):
            raise ValueError("A scene may use each layer only once.")
        if len(self.layer_ids) > MAX_LAYERS:
            raise ValueError(f"A scene may have at most {MAX_LAYERS} layers.")
