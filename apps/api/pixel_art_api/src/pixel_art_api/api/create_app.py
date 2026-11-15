import os
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path as PathParameter, Request, status

from pixel_art_api.api.picture_schema import PictureSchema
from pixel_art_api.api.preset_schema import PresetNameSchema, PresetSchema
from pixel_art_api.api.scene_design_schema import LayerDesignSchema, SceneDesignSchema
from pixel_art_api.core.pixel_art_store import PixelArtStore


def create_app(database_path: Path) -> FastAPI:
    """ Creates the pixel art API, backed by a single database.

    Args:
        database_path:
            Location of the SQLite database file, which is created if it doesn't exist. Its directory must exist.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Pixel art API")
    app.state.store = PixelArtStore(database_path)
    app.include_router(_pictures_router)
    app.include_router(_layers_router)
    app.include_router(_scenes_router)
    app.include_router(_presets_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the pixel art API, using the database named by the `PIXEL_ART_DATABASE_PATH` environment variable.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If the environment variable is not set. There is deliberately no default, so that a configuration
            mistake stops the server rather than silently creating a new, empty database.
    """
    return create_app(Path(os.environ["PIXEL_ART_DATABASE_PATH"]))


def _get_store(request: Request) -> PixelArtStore:
    return request.app.state.store


_StoreDependency = Annotated[PixelArtStore, Depends(_get_store)]

# The id of a picture, such as "cow", a layer, such as "rain", or a scene, such as "day-rain". The site decides which of
# them it has of its own, and makes up ids for those of one's own.
_DesignId = Annotated[str, PathParameter(pattern=r"^[a-z0-9-]{1,64}$")]

# Each picture is kept under the id of the site's picture that it redraws, or under an id that the site makes up for a
# new picture of one's own. A picture of the site's own that isn't kept here is shown as the site draws it, so a picture
# can be put and deleted, but there is nothing to create.
_pictures_router = APIRouter(prefix="/pictures", tags=["pictures"])


@_pictures_router.get("")
def list_pictures(store: _StoreDependency) -> dict[str, PictureSchema]:
    """ Gives every picture that is kept, keyed by its id. """
    return {picture_id: PictureSchema.from_picture(picture) for picture_id, picture in store.list_pictures().items()}


@_pictures_router.put("/{picture_id}")
def save_picture(picture_id: _DesignId, picture_schema: PictureSchema, store: _StoreDependency) -> PictureSchema:
    """ Keeps a picture, replacing any picture already kept under its id. """
    picture = picture_schema.to_picture()
    store.save_picture(picture_id, picture)
    return PictureSchema.from_picture(picture)


@_pictures_router.delete("/{picture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_picture(picture_id: _DesignId, store: _StoreDependency) -> None:
    """ Shows the site's own picture again, or deletes a picture of one's own. Does nothing if no picture is kept. """
    store.delete_picture(picture_id)


# Each layer is kept under its id, in the same way as the pictures: one of the site's layers that isn't kept here is
# shown as the site designs it.
_layers_router = APIRouter(prefix="/layers", tags=["layers"])


@_layers_router.get("")
def list_layers(store: _StoreDependency) -> dict[str, LayerDesignSchema]:
    """ Gives every layer that is kept, keyed by its id. """
    return {layer_id: LayerDesignSchema.from_layer(layer) for layer_id, layer in store.list_layers().items()}


@_layers_router.put("/{layer_id}")
def save_layer(layer_id: _DesignId, layer_schema: LayerDesignSchema, store: _StoreDependency) -> LayerDesignSchema:
    """ Keeps a layer, replacing any layer already kept under its id. """
    layer = layer_schema.to_layer()
    store.save_layer(layer_id, layer)
    return LayerDesignSchema.from_layer(layer)


@_layers_router.delete("/{layer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_layer(layer_id: _DesignId, store: _StoreDependency) -> None:
    """ Forgets a layer: one of the site's own is shown as the site designs it again, and one's own is gone. Does
    nothing if no layer is kept under the id. """
    store.delete_layer(layer_id)


# Each scene is kept under its id in the same way: the site's scene for a time of day and weather that isn't kept here
# is shown as the site designs it.
_scenes_router = APIRouter(prefix="/scenes", tags=["scenes"])


@_scenes_router.get("")
def list_scenes(store: _StoreDependency) -> dict[str, SceneDesignSchema]:
    """ Gives every scene that is kept, keyed by its id. """
    return {scene_id: SceneDesignSchema.from_scene(scene) for scene_id, scene in store.list_scenes().items()}


@_scenes_router.put("/{scene_id}")
def save_scene(scene_id: _DesignId, scene_schema: SceneDesignSchema, store: _StoreDependency) -> SceneDesignSchema:
    """ Keeps a scene, replacing any scene already kept under its id. """
    scene = scene_schema.to_scene()
    store.save_scene(scene_id, scene)
    return SceneDesignSchema.from_scene(scene)


@_scenes_router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene(scene_id: _DesignId, store: _StoreDependency) -> None:
    """ Forgets a scene: a scene of the site's own is shown as the site designs it again, and one's own is gone. Does
    nothing if no scene is kept under the id. """
    store.delete_scene(scene_id)


# A preset is a copy of everything above, as it was when the preset was saved. The copy stays here: clients see only
# each preset's name, and ask for one to be applied, saved over, renamed or deleted. A new database starts with one,
# which holds nothing, so that applying it shows everything as the site makes it.
_presets_router = APIRouter(prefix="/presets", tags=["presets"])


@_presets_router.get("")
def list_presets(store: _StoreDependency) -> list[PresetSchema]:
    """ Lists every preset, oldest first. """
    return [PresetSchema.from_preset(preset) for preset in store.list_presets()]


@_presets_router.post("", status_code=status.HTTP_201_CREATED)
def save_preset(name_schema: PresetNameSchema, store: _StoreDependency) -> PresetSchema:
    """ Saves every picture, layer and scene as they are now, as a new preset. """
    return PresetSchema.from_preset(store.save_preset(name_schema.name))


@_presets_router.post("/{preset_id}/apply", status_code=status.HTTP_204_NO_CONTENT)
def apply_preset(preset_id: UUID, store: _StoreDependency) -> None:
    """ Makes every picture, layer and scene what it was when the preset was saved, in place of what is kept now.

    Answers 409 if there is no such preset: it was most likely deleted on another screen, which the person can be told,
    rather than being a mistake in the request. """
    if not store.apply_preset(preset_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "That preset has been deleted.")


@_presets_router.post("/{preset_id}/overwrite", status_code=status.HTTP_204_NO_CONTENT)
def overwrite_preset(preset_id: UUID, store: _StoreDependency) -> None:
    """ Saves every picture, layer and scene as they are now into the preset, in place of what it held. Answers 409 if
    there is no such preset, in the same way as applying one. """
    if not store.overwrite_preset(preset_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "That preset has been deleted.")


@_presets_router.patch("/{preset_id}")
def rename_preset(preset_id: UUID, name_schema: PresetNameSchema, store: _StoreDependency) -> PresetSchema:
    """ Renames a preset. Answers 409 if there is no such preset, in the same way as applying one. """
    if not store.rename_preset(preset_id, name_schema.name):
        raise HTTPException(status.HTTP_409_CONFLICT, "That preset has been deleted.")
    return next(PresetSchema.from_preset(preset) for preset in store.list_presets() if preset.id == preset_id)


@_presets_router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(preset_id: UUID, store: _StoreDependency) -> None:
    """ Deletes a preset, leaving what is kept now as it is. Does nothing if there is no such preset. """
    store.delete_preset(preset_id)
