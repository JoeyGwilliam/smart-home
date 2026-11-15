import sqlite3
from pathlib import Path
from uuid import uuid7

import pytest

from pixel_art_api.core.layer_design import LayerDesign
from pixel_art_api.core.picture import Picture, PictureFrame, PictureVariant
from pixel_art_api.core.pixel_art_store import PixelArtStore
from pixel_art_api.core.scene_design import SceneDesign
from pixel_art_api.core.scene_placement import ScenePlacement

SUN = Picture(variants=(PictureVariant(name="Midday", palette={"o": "#ffd94a"}, frames=(PictureFrame(rows=(".o.", "ooo")),)),))
SKY = ScenePlacement(id="sky", picture_id="sky", x=0, anchor="top", y=0, pixel_size=4, spread="screen")
DAY = SceneDesign(name="Day", time_of_day="day", weather="clear", layer_ids=("sky", "animals-day"))
SKY_LAYER = LayerDesign(name="Sky", placements=(SKY,))


def test_keeps_nothing_but_the_site_preset_when_database_is_new(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")

    assert store.list_pictures() == {}
    assert store.list_scenes() == {}
    assert store.list_layers() == {}
    assert [preset.name for preset in store.list_presets()] == ["The site's own design"]


def test_forgets_the_whole_design_when_applying_the_site_preset(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    [site_preset] = store.list_presets()
    store.save_picture("sun", SUN)
    store.save_scene("day-clear", DAY)

    store.apply_preset(site_preset.id)

    assert store.list_pictures() == {}
    assert store.list_scenes() == {}


def test_keeps_the_site_preset_deleted_when_the_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "pixel_art.db"
    store = PixelArtStore(database_path)
    [site_preset] = store.list_presets()
    store.delete_preset(site_preset.id)

    reopened_presets = PixelArtStore(database_path).list_presets()

    assert reopened_presets == []


def test_keeps_every_variant_and_frame_of_picture_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "pixel_art.db"
    rain = Picture(
        variants=(
            PictureVariant(
                name="Rain",
                palette={"r": "#7799cc80"},
                frames=(PictureFrame(rows=("r.", ".."), milliseconds=140), PictureFrame(rows=("..", ".r"), milliseconds=160)),
            ),
            PictureVariant(name="Drizzle", palette={"r": "#7799cc80"}, frames=(PictureFrame(rows=("r",)),)),
        ),
        title="My rain",
    )
    PixelArtStore(database_path).save_picture("custom-rain", rain)

    reopened_pictures = PixelArtStore(database_path).list_pictures()

    assert reopened_pictures == {"custom-rain": rain}


def test_replaces_picture_when_saving_another_under_the_same_id(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("sun", SUN)
    redrawn_sun = Picture(variants=(PictureVariant(name="Midday", palette={"o": "#ff0000"}, frames=(PictureFrame(rows=("o",)),)),))

    store.save_picture("sun", redrawn_sun)

    assert store.list_pictures() == {"sun": redrawn_sun}


def test_forgets_only_that_picture_when_deleting_it(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("sun", SUN)
    store.save_picture("moon", SUN)

    store.delete_picture("moon")

    assert store.list_pictures() == {"sun": SUN}


def test_keeps_every_part_of_scene_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "pixel_art.db"
    scene = SceneDesign(name="Christmas", time_of_day="night", weather="snow", layer_ids=("sky", "custom-tree", "snow"))
    PixelArtStore(database_path).save_scene("custom-christmas", scene)

    reopened_scenes = PixelArtStore(database_path).list_scenes()

    assert reopened_scenes == {"custom-christmas": scene}


def test_keeps_scene_and_picture_apart_when_they_share_an_id(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("day", SUN)
    store.save_scene("day", DAY)

    store.delete_scene("day")

    assert store.list_pictures() == {"day": SUN}
    assert store.list_scenes() == {}


def test_keeps_every_part_of_layer_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "pixel_art.db"
    cow = ScenePlacement(id="cow-1", picture_id="cow", variant="Sleeping", x=10, anchor="bottom", y=28, pixel_size=4, motion="hop", opacity=90)
    layer = LayerDesign(name="Animals at night", placements=(cow,))
    PixelArtStore(database_path).save_layer("animals-night", layer)

    reopened_layers = PixelArtStore(database_path).list_layers()

    assert reopened_layers == {"animals-night": layer}


def test_forgets_only_that_layer_when_deleting_it(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_layer("sky", SKY_LAYER)
    store.save_layer("rain", LayerDesign(name="Rain"))

    store.delete_layer("rain")

    assert store.list_layers() == {"sky": SKY_LAYER}


def test_lists_preset_with_its_name_when_it_has_been_saved(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")

    preset = store.save_preset("Winter")

    assert preset.name == "Winter"
    assert store.list_presets()[-1] == preset


def test_raises_value_error_and_saves_nothing_when_preset_name_is_blank(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")

    with pytest.raises(ValueError):
        store.save_preset(" ")

    assert [preset.name for preset in store.list_presets()] == ["The site's own design"]


def test_puts_back_the_design_as_it_was_saved_when_applying_a_preset(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("sun", SUN)
    store.save_scene("day", DAY)
    preset = store.save_preset("Summer")
    store.delete_picture("sun")
    store.save_scene("night-clear", SceneDesign(name="Night", time_of_day="night", weather="clear"))
    store.save_layer("rain", LayerDesign(name="Rain"))

    was_applied = store.apply_preset(preset.id)

    assert was_applied
    assert store.list_pictures() == {"sun": SUN}
    assert store.list_scenes() == {"day": DAY}
    assert store.list_layers() == {}


def test_leaves_preset_as_it_was_saved_when_the_design_changes_later(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("sun", SUN)
    preset = store.save_preset("Summer")
    store.save_picture("sun", Picture(variants=(PictureVariant(name="Midday", palette={"o": "#000000"}, frames=(PictureFrame(rows=("o",)),)),)))

    store.apply_preset(preset.id)

    assert store.list_pictures() == {"sun": SUN}


def test_changes_nothing_and_says_so_when_applying_a_preset_that_does_not_exist(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("sun", SUN)

    was_applied = store.apply_preset(uuid7())

    assert not was_applied
    assert store.list_pictures() == {"sun": SUN}


def test_keeps_the_design_when_deleting_a_preset(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("sun", SUN)
    preset = store.save_preset("Summer")

    store.delete_preset(preset.id)

    assert preset not in store.list_presets()
    assert store.list_pictures() == {"sun": SUN}


def test_holds_the_design_as_it_is_now_when_saving_over_a_preset(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    preset = store.save_preset("Summer")
    store.save_picture("sun", SUN)

    was_saved = store.overwrite_preset(preset.id)
    store.delete_picture("sun")
    store.apply_preset(preset.id)

    assert was_saved
    assert store.list_pictures() == {"sun": SUN}


def test_changes_nothing_and_says_so_when_saving_over_a_preset_that_does_not_exist(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")

    was_saved = store.overwrite_preset(uuid7())

    assert not was_saved


def test_keeps_what_the_preset_holds_when_renaming_it(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    store.save_picture("sun", SUN)
    preset = store.save_preset("Summer")
    store.delete_picture("sun")

    was_renamed = store.rename_preset(preset.id, "Midsummer")
    store.apply_preset(preset.id)

    assert was_renamed
    assert [listed.name for listed in store.list_presets() if listed.id == preset.id] == ["Midsummer"]
    assert store.list_pictures() == {"sun": SUN}


def test_raises_value_error_when_renaming_a_preset_to_a_blank_name(tmp_path: Path) -> None:
    store = PixelArtStore(tmp_path / "pixel_art.db")
    preset = store.save_preset("Summer")

    with pytest.raises(ValueError):
        store.rename_preset(preset.id, " ")


def test_adds_the_site_preset_once_when_a_database_made_before_it_is_opened(tmp_path: Path) -> None:
    database_path = tmp_path / "pixel_art.db"
    store = PixelArtStore(database_path)
    with sqlite3.connect(database_path) as connection:
        connection.execute("DELETE FROM markers")
        connection.execute("DELETE FROM design_presets")
    store.save_preset("Winter")

    reopened_presets = PixelArtStore(database_path).list_presets()

    assert sorted(preset.name for preset in reopened_presets) == ["The site's own design", "Winter"]
