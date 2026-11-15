import pytest

from pixel_art_api.core.scene_placement import ScenePlacement


def test_keeps_every_field_when_placement_is_valid() -> None:
    placement = ScenePlacement(
        id="cow-1",
        picture_id="cow",
        variant="Sleeping",
        x=10,
        anchor="bottom",
        y=28,
        pixel_size=4,
        spread="none",
        opacity=60,
        is_flipped=True,
        motion="hop",
    )

    assert placement.variant == "Sleeping"
    assert placement.opacity == 60
    assert placement.motion == "hop"


def test_allows_large_y_when_counting_screen_pixels_from_the_bottom() -> None:
    placement = ScenePlacement(id="sun", picture_id="sun", x=10, anchor="bottom", y=400, pixel_size=8)

    assert placement.y == 400


def test_raises_value_error_when_y_from_the_top_is_beyond_150_percent() -> None:
    with pytest.raises(ValueError):
        ScenePlacement(id="sun", picture_id="sun", x=10, anchor="top", y=151, pixel_size=8)


def test_raises_value_error_when_x_is_beyond_150_percent() -> None:
    with pytest.raises(ValueError):
        ScenePlacement(id="sun", picture_id="sun", x=151, anchor="top", y=10, pixel_size=8)


@pytest.mark.parametrize("pixel_size", [0, 33])
def test_raises_value_error_when_pixel_size_is_outside_1_to_32(pixel_size: int) -> None:
    with pytest.raises(ValueError):
        ScenePlacement(id="sun", picture_id="sun", x=10, anchor="top", y=10, pixel_size=pixel_size)


@pytest.mark.parametrize("opacity", [-1, 101])
def test_raises_value_error_when_opacity_is_outside_0_to_100(opacity: int) -> None:
    with pytest.raises(ValueError):
        ScenePlacement(id="fog", picture_id="fog", x=0, anchor="top", y=0, pixel_size=4, spread="screen", opacity=opacity)


def test_raises_value_error_when_picture_id_has_characters_that_are_not_allowed() -> None:
    with pytest.raises(ValueError):
        ScenePlacement(id="sun", picture_id="Midday Sun", x=10, anchor="top", y=10, pixel_size=8)


def test_raises_value_error_when_motion_is_unknown() -> None:
    with pytest.raises(ValueError):
        ScenePlacement(id="sun", picture_id="sun", x=10, anchor="top", y=10, pixel_size=8, motion="spin")  # type: ignore[arg-type]


def test_raises_value_error_when_spread_is_unknown() -> None:
    with pytest.raises(ValueError):
        ScenePlacement(id="sky", picture_id="sky", x=0, anchor="top", y=0, pixel_size=4, spread="everywhere")  # type: ignore[arg-type]
