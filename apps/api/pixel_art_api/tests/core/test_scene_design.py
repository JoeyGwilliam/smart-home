import pytest

from pixel_art_api.core.scene_design import SceneDesign


def test_keeps_layers_in_order_when_scene_is_valid() -> None:
    scene = SceneDesign(name="Rainy day", time_of_day="day", weather="rain", layer_ids=("sky", "animals-day", "rain"))

    assert scene.layer_ids == ("sky", "animals-day", "rain")


def test_raises_value_error_when_name_is_blank() -> None:
    with pytest.raises(ValueError):
        SceneDesign(name="  ", time_of_day="day", weather="clear")


def test_raises_value_error_when_name_is_longer_than_80_characters() -> None:
    with pytest.raises(ValueError):
        SceneDesign(name="a" * 81, time_of_day="day", weather="clear")


def test_raises_value_error_when_a_layer_is_used_twice() -> None:
    with pytest.raises(ValueError):
        SceneDesign(name="Day", time_of_day="day", weather="clear", layer_ids=("sky", "sky"))


def test_raises_value_error_when_a_layer_id_has_characters_that_are_not_allowed() -> None:
    with pytest.raises(ValueError):
        SceneDesign(name="Day", time_of_day="day", weather="clear", layer_ids=("Day Sky",))


def test_raises_value_error_when_time_of_day_is_unknown() -> None:
    with pytest.raises(ValueError):
        SceneDesign(name="Day", time_of_day="midnight", weather="clear")  # type: ignore[arg-type]


def test_raises_value_error_when_weather_is_unknown() -> None:
    with pytest.raises(ValueError):
        SceneDesign(name="Day", time_of_day="day", weather="hail")  # type: ignore[arg-type]
