import os
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid7

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, Response, status

from recipes_api.api.recipe_schema import PictureCreatedSchema, RecipeSchema
from recipes_api.core.recipe import Recipe
from recipes_api.core.recipe_picture import RecipePicture
from recipes_api.core.recipe_store import PictureUnavailableError, RecipeStore

# A picture never changes once it is stored, so a browser can keep its copy for as long as it likes.
_PICTURE_CACHE_CONTROL = "public, max-age=31536000, immutable"


def create_app(database_path: Path) -> FastAPI:
    """ Creates the recipes API, backed by a single database.

    Args:
        database_path:
            Location of the SQLite database file, which is created if it doesn't exist. Its directory must exist.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Recipes API")
    app.state.recipe_store = RecipeStore(database_path)
    app.include_router(_recipes_router)
    app.include_router(_pictures_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the recipes API, using the database named by the `RECIPES_DATABASE_PATH` environment variable.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If the environment variable is not set. There is deliberately no default, so that a configuration
            mistake stops the server rather than silently creating a new, empty database.
    """
    return create_app(Path(os.environ["RECIPES_DATABASE_PATH"]))


def _get_store(request: Request) -> RecipeStore:
    return request.app.state.recipe_store


_StoreDependency = Annotated[RecipeStore, Depends(_get_store)]

_recipes_router = APIRouter(prefix="/recipes", tags=["recipes"])


@_recipes_router.post("", status_code=status.HTTP_201_CREATED)
def create_recipe(recipe_schema: RecipeSchema, store: _StoreDependency) -> RecipeSchema:
    recipe = recipe_schema.to_recipe(uuid7())
    _save_recipe(recipe, store)
    return RecipeSchema.from_recipe(recipe)


@_recipes_router.get("")
def list_recipes(store: _StoreDependency) -> list[RecipeSchema]:
    """ Lists every recipe, in alphabetical order of name, ignoring capitals. """
    return [RecipeSchema.from_recipe(recipe) for recipe in store.list_recipes()]


@_recipes_router.get("/{recipe_id}")
def get_recipe(recipe_id: UUID, store: _StoreDependency) -> RecipeSchema:
    recipe = store.get_recipe(recipe_id)
    if recipe is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No recipe has the id {recipe_id}.")
    return RecipeSchema.from_recipe(recipe)


@_recipes_router.put("/{recipe_id}")
def save_recipe(recipe_id: UUID, recipe_schema: RecipeSchema, store: _StoreDependency) -> RecipeSchema:
    recipe = recipe_schema.to_recipe(recipe_id)
    _save_recipe(recipe, store)
    return RecipeSchema.from_recipe(recipe)


@_recipes_router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: UUID, store: _StoreDependency) -> None:
    store.delete_recipe(recipe_id)


def _save_recipe(recipe: Recipe, store: RecipeStore) -> None:
    try:
        store.save_recipe(recipe)
    except PictureUnavailableError as error:
        # Only the store can tell whether a picture is free to use, so this is the one rule of a valid recipe that the
        # schema can't apply. It is refused the same way as the others.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error


# Pictures are kept apart from recipes so that listing recipes stays quick, and so that each picture, which never
# changes, can be cached by the browser.
_pictures_router = APIRouter(prefix="/pictures", tags=["pictures"])


@_pictures_router.post("", status_code=status.HTTP_201_CREATED)
async def create_picture(request: Request, content_type: Annotated[str, Header()], store: _StoreDependency) -> PictureCreatedSchema:
    """ Stores the image file sent as the request's body, so that a recipe can be saved with it.

    The body is the file itself, with its media type, such as "image/jpeg", as the Content-Type. A picture that no
    recipe takes up stays stored, so clients upload one only when a recipe is about to be saved with it.
    """
    try:
        picture = RecipePicture(content=await request.body(), content_type=content_type)
    except ValueError as error:
        # RecipePicture owns the rules for a valid picture. Its reasons are written for the person who chose it.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

    store.save_picture(picture)
    return PictureCreatedSchema(id=picture.id)


@_pictures_router.get("/{picture_id}", response_class=Response)
def get_picture(picture_id: UUID, store: _StoreDependency) -> Response:
    picture = store.get_picture(picture_id)
    if picture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No picture has the id {picture_id}.")
    return Response(picture.content, media_type=picture.content_type, headers={"Cache-Control": _PICTURE_CACHE_CONTROL})
