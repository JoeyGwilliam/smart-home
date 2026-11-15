from dataclasses import asdict
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator

from pixel_art_api.core.layer_design import LayerDesign
from pixel_art_api.core.scene_design import SceneDesign
from pixel_art_api.core.scene_placement import ScenePlacement


class ScenePlacementSchema(BaseModel):
    """ The JSON representation of a picture placed in a layer (see ScenePlacement, which owns the rules). """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    id: str
    picture_id: str
    x: float
    anchor: Literal["top", "bottom"]
    y: float
    pixel_size: int
    variant: str = ""
    spread: Literal["none", "across", "tile", "screen"] = "none"
    opacity: int = 100
    is_flipped: bool = False
    motion: Literal["none", "drift", "hop", "flutter", "wander"] = "none"

    def to_placement(self) -> ScenePlacement:
        """ Converts this representation to a placement. """
        return ScenePlacement(**self.model_dump())


class LayerDesignSchema(BaseModel):
    """ The JSON representation of a layer, used for both requests and responses (see LayerDesign, which owns the
    rules).

    Attributes:
        name:
            What the layer is called.
        placements:
            The pictures in the layer, each drawn over the ones before it.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    name: str
    placements: list[ScenePlacementSchema] = []

    @model_validator(mode="after")
    def _apply_layer_rules(self) -> Self:
        # LayerDesign and ScenePlacement own the rules for a valid layer. A ValueError raised here becomes a 422
        # response.
        self.to_layer()
        return self

    @classmethod
    def from_layer(cls, layer: LayerDesign) -> Self:
        """ Creates the JSON representation of a layer. """
        return cls.model_validate(asdict(layer))

    def to_layer(self) -> LayerDesign:
        """ Converts this representation to a layer. """
        return LayerDesign(name=self.name, placements=tuple(placement.to_placement() for placement in self.placements))


class SceneDesignSchema(BaseModel):
    """ The JSON representation of a scene, used for both requests and responses (see SceneDesign, which owns the
    rules).

    Attributes:
        name:
            What the scene is called.
        time_of_day:
            Whose colours the scene takes, with its weather.
        weather:
            Whose colours the scene takes, with its time of day.
        layer_ids:
            The ids of the layers in the scene, back first.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    name: str
    time_of_day: Literal["sunrise", "day", "sunset", "night"]
    weather: Literal["clear", "cloudy", "fog", "drizzle", "rain", "snow", "thunder"]
    layer_ids: list[str] = []

    @model_validator(mode="after")
    def _apply_scene_rules(self) -> Self:
        # SceneDesign owns the rules for a valid scene. A ValueError raised here becomes a 422 response.
        self.to_scene()
        return self

    @classmethod
    def from_scene(cls, scene: SceneDesign) -> Self:
        """ Creates the JSON representation of a scene. """
        return cls.model_validate(asdict(scene))

    def to_scene(self) -> SceneDesign:
        """ Converts this representation to a scene. """
        return SceneDesign(name=self.name, time_of_day=self.time_of_day, weather=self.weather, layer_ids=tuple(self.layer_ids))
