import pytest

from pixel_art_api.core.picture import Picture, PictureFrame, PictureVariant

SUN_FRAME = PictureFrame(rows=(".o.", "ooo"))
SUN = PictureVariant(name="Midday", palette={"o": "#ffd94a"}, frames=(SUN_FRAME,))


def test_keeps_rows_and_time_when_frame_is_valid() -> None:
    frame = PictureFrame(rows=(".o.", "ooo"), milliseconds=750)

    assert frame.rows == (".o.", "ooo")
    assert frame.milliseconds == 750


def test_raises_value_error_when_frame_has_no_rows() -> None:
    with pytest.raises(ValueError):
        PictureFrame(rows=())


def test_raises_value_error_when_frame_is_wider_than_128_pixels() -> None:
    with pytest.raises(ValueError):
        PictureFrame(rows=("." * 129,))


def test_raises_value_error_when_rows_of_frame_differ_in_length() -> None:
    with pytest.raises(ValueError):
        PictureFrame(rows=("...", ".."))


@pytest.mark.parametrize("milliseconds", [19, 60_001])
def test_raises_value_error_when_frame_shows_for_too_short_or_long(milliseconds: int) -> None:
    with pytest.raises(ValueError):
        PictureFrame(rows=(".",), milliseconds=milliseconds)


def test_keeps_every_frame_in_order_when_variant_is_animated() -> None:
    blink = PictureFrame(rows=("...", "ooo"))

    variant = PictureVariant(name="Blinking", palette={"o": "#ffd94a"}, frames=(SUN_FRAME, blink))

    assert variant.frames == (SUN_FRAME, blink)


@pytest.mark.parametrize("colour", ["#fff8e7", "#fff8e780", "var(--cloud-shade)"])
def test_accepts_colour_when_it_is_solid_see_through_or_a_scene_colour(colour: str) -> None:
    variant = PictureVariant(name="Cloud", palette={"c": colour}, frames=(PictureFrame(rows=("c",)),))

    assert variant.palette == {"c": colour}


@pytest.mark.parametrize("colour", ["red", "#fff", "url(evil)", "var(--cloud); background: red"])
def test_raises_value_error_when_colour_is_not_allowed(colour: str) -> None:
    with pytest.raises(ValueError):
        PictureVariant(name="Cloud", palette={"c": colour}, frames=(PictureFrame(rows=("c",)),))


def test_raises_value_error_when_variant_has_no_frames() -> None:
    with pytest.raises(ValueError):
        PictureVariant(name="Empty", palette={}, frames=())


def test_raises_value_error_when_frames_of_variant_differ_in_size() -> None:
    with pytest.raises(ValueError):
        PictureVariant(name="Uneven", palette={"o": "#ffd94a"}, frames=(SUN_FRAME, PictureFrame(rows=("o",))))


def test_raises_value_error_when_pixel_has_no_colour_in_palette() -> None:
    with pytest.raises(ValueError):
        PictureVariant(name="Midday", palette={"o": "#ffd94a"}, frames=(PictureFrame(rows=("ox",)),))


def test_raises_value_error_when_palette_gives_transparent_pixel_a_colour() -> None:
    with pytest.raises(ValueError):
        PictureVariant(name="Midday", palette={".": "#ffffff"}, frames=(PictureFrame(rows=(".",)),))


def test_raises_value_error_when_variant_name_is_blank() -> None:
    with pytest.raises(ValueError):
        PictureVariant(name=" ", palette={"o": "#ffd94a"}, frames=(SUN_FRAME,))


def test_keeps_title_when_picture_is_one_of_ones_own() -> None:
    picture = Picture(variants=(SUN,), title="Castle")

    assert picture.title == "Castle"


def test_raises_value_error_when_picture_has_no_variants() -> None:
    with pytest.raises(ValueError):
        Picture(variants=())


def test_raises_value_error_when_two_variants_share_a_name() -> None:
    with pytest.raises(ValueError):
        Picture(variants=(SUN, SUN))


def test_raises_value_error_when_title_is_blank() -> None:
    with pytest.raises(ValueError):
        Picture(variants=(SUN,), title=" ")
