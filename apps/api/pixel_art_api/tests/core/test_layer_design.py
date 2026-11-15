import pytest

from pixel_art_api.core.layer_design import LayerDesign
from pixel_art_api.core.scene_placement import ScenePlacement

RAIN = ScenePlacement(id="rain", picture_id="rain", x=0, anchor="top", y=0, pixel_size=4, spread="tile")


def test_keeps_name_and_placements_when_layer_is_valid() -> None:
    layer = LayerDesign(name="Rain", placements=(RAIN,))

    assert layer.name == "Rain"
    assert layer.placements == (RAIN,)


def test_raises_value_error_when_name_is_blank() -> None:
    with pytest.raises(ValueError):
        LayerDesign(name=" ")


def test_raises_value_error_when_two_placements_share_an_id() -> None:
    with pytest.raises(ValueError):
        LayerDesign(name="Rain", placements=(RAIN, RAIN))
