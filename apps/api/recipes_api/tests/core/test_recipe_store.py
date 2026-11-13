from dataclasses import replace
from pathlib import Path
from uuid import uuid7

import pytest

from recipes_api.core.recipe import Recipe
from recipes_api.core.recipe_picture import RecipePicture
from recipes_api.core.recipe_store import PictureUnavailableError, RecipeStore


def test_returns_all_fields_when_getting_saved_recipe(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    picture = RecipePicture(content=b"\xff\xd8\xff", content_type="image/jpeg")
    store.save_picture(picture)
    recipe = Recipe(
        name="Shepherd's pie",
        ingredients=("500g lamb mince", "1kg potatoes", "1 onion"),
        instructions="Brown the mince.\nTop with mash and bake.",
        time_minutes=90,
        picture_id=picture.id,
    )

    store.save_recipe(recipe)

    assert store.get_recipe(recipe.id) == recipe


def test_returns_saved_recipe_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "recipes.db"
    recipe = Recipe(name="Beans on toast", ingredients=("Beans", "Toast"))
    RecipeStore(database_path).save_recipe(recipe)

    loaded_recipe = RecipeStore(database_path).get_recipe(recipe.id)

    assert loaded_recipe == recipe


def test_returns_none_when_getting_missing_recipe(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")

    assert store.get_recipe(uuid7()) is None


def test_replaces_recipe_when_saving_with_existing_id(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    recipe = Recipe(name="Beans on toast", ingredients=("Beans", "Toast"), time_minutes=5)
    store.save_recipe(recipe)
    edited_recipe = replace(recipe, ingredients=("Beans", "Toast", "Cheese"), time_minutes=None)

    store.save_recipe(edited_recipe)

    assert store.list_recipes() == [edited_recipe]


def test_lists_recipes_alphabetically_ignoring_capitals_when_several_exist(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    store.save_recipe(Recipe(name="lasagne", ingredients=("Pasta",)))
    store.save_recipe(Recipe(name="Chilli", ingredients=("Beans",)))
    store.save_recipe(Recipe(name="Moussaka", ingredients=("Aubergine",)))

    names = [recipe.name for recipe in store.list_recipes()]

    assert names == ["Chilli", "lasagne", "Moussaka"]


def test_deletes_recipe_and_its_picture_when_deleting_recipe(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    picture = RecipePicture(content=b"\x89PNG", content_type="image/png")
    store.save_picture(picture)
    recipe = Recipe(name="Beans on toast", ingredients=("Beans",), picture_id=picture.id)
    store.save_recipe(recipe)

    store.delete_recipe(recipe.id)

    assert store.get_recipe(recipe.id) is None
    assert store.get_picture(picture.id) is None


def test_does_nothing_when_deleting_missing_recipe(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    recipe = Recipe(name="Beans on toast", ingredients=("Beans",))
    store.save_recipe(recipe)

    store.delete_recipe(uuid7())

    assert store.list_recipes() == [recipe]


def test_returns_saved_picture_when_getting_it(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    picture = RecipePicture(content=b"\x89PNG", content_type="image/png")

    store.save_picture(picture)

    assert store.get_picture(picture.id) == picture


def test_deletes_old_picture_when_recipe_is_saved_with_another(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    old_picture = RecipePicture(content=b"old", content_type="image/png")
    new_picture = RecipePicture(content=b"new", content_type="image/png")
    store.save_picture(old_picture)
    store.save_picture(new_picture)
    recipe = Recipe(name="Beans on toast", ingredients=("Beans",), picture_id=old_picture.id)
    store.save_recipe(recipe)

    store.save_recipe(replace(recipe, picture_id=new_picture.id))

    assert store.get_picture(old_picture.id) is None
    assert store.get_picture(new_picture.id) == new_picture


def test_deletes_old_picture_when_recipe_is_saved_without_one(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    picture = RecipePicture(content=b"\x89PNG", content_type="image/png")
    store.save_picture(picture)
    recipe = Recipe(name="Beans on toast", ingredients=("Beans",), picture_id=picture.id)
    store.save_recipe(recipe)

    store.save_recipe(replace(recipe, picture_id=None))

    assert store.get_picture(picture.id) is None


def test_keeps_picture_when_recipe_is_saved_again_with_it(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    picture = RecipePicture(content=b"\x89PNG", content_type="image/png")
    store.save_picture(picture)
    recipe = Recipe(name="Beans on toast", ingredients=("Beans",), picture_id=picture.id)
    store.save_recipe(recipe)

    store.save_recipe(replace(recipe, name="Cheesy beans on toast"))

    assert store.get_picture(picture.id) == picture


def test_raises_when_saving_recipe_with_missing_picture(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    recipe = Recipe(name="Beans on toast", ingredients=("Beans",), picture_id=uuid7())

    with pytest.raises(PictureUnavailableError, match="Upload the picture first"):
        store.save_recipe(recipe)


def test_raises_when_saving_recipe_with_another_recipes_picture(tmp_path: Path) -> None:
    store = RecipeStore(tmp_path / "recipes.db")
    picture = RecipePicture(content=b"\x89PNG", content_type="image/png")
    store.save_picture(picture)
    store.save_recipe(Recipe(name="Beans on toast", ingredients=("Beans",), picture_id=picture.id))

    with pytest.raises(PictureUnavailableError, match="another recipe"):
        store.save_recipe(Recipe(name="Cheese on toast", ingredients=("Cheese",), picture_id=picture.id))
