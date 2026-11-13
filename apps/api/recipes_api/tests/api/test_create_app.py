from pathlib import Path
from uuid import uuid7

import pytest
from fastapi.testclient import TestClient

from recipes_api.api.create_app import create_app, create_app_from_environment


def test_returns_201_with_generated_id_when_creating_recipe(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    recipe = {
        "name": "Shepherd's pie",
        "ingredients": ["500g lamb mince", "1kg potatoes"],
        "instructions": "Brown the mince, then top with mash and bake.",
        "time_minutes": 90,
        "picture_id": None,
    }

    response = client.post("/recipes", json=recipe)

    assert response.status_code == 201
    assert response.json()["id"]
    assert {key: value for key, value in response.json().items() if key != "id"} == recipe


def test_has_no_instructions_time_or_picture_when_creating_with_only_name_and_ingredients(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))

    response = client.post("/recipes", json={"name": "Beans on toast", "ingredients": ["Beans", "Toast"]})

    assert response.json()["instructions"] is None
    assert response.json()["time_minutes"] is None
    assert response.json()["picture_id"] is None


def test_returns_422_when_creating_recipe_without_ingredients(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))

    response = client.post("/recipes", json={"name": "Beans on toast", "ingredients": []})

    assert response.status_code == 422


def test_returns_recipe_when_getting_created_id(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    created_recipe = client.post("/recipes", json={"name": "Beans on toast", "ingredients": ["Beans"]}).json()

    response = client.get(f"/recipes/{created_recipe['id']}")

    assert response.status_code == 200
    assert response.json() == created_recipe


def test_returns_404_when_getting_missing_recipe(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))

    response = client.get(f"/recipes/{uuid7()}")

    assert response.status_code == 404


def test_lists_recipes_alphabetically_when_several_exist(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    client.post("/recipes", json={"name": "Lasagne", "ingredients": ["Pasta"]})
    client.post("/recipes", json={"name": "Chilli", "ingredients": ["Beans"]})

    response = client.get("/recipes")

    assert [recipe["name"] for recipe in response.json()] == ["Chilli", "Lasagne"]


def test_overwrites_every_field_when_replacing_recipe(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    original_recipe = {"name": "Beans on toast", "ingredients": ["Beans", "Toast"], "instructions": "Toast it.", "time_minutes": 5}
    created_recipe = client.post("/recipes", json=original_recipe).json()
    recipe_url = f"/recipes/{created_recipe['id']}"

    response = client.put(recipe_url, json={"name": "Cheese on toast", "ingredients": ["Cheese"]})

    assert response.status_code == 200
    assert client.get(recipe_url).json() == {
        "id": created_recipe["id"],
        "name": "Cheese on toast",
        "ingredients": ["Cheese"],
        "instructions": None,
        "time_minutes": None,
        "picture_id": None,
    }


def test_returns_204_and_forgets_recipe_when_deleting_it(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    created_recipe = client.post("/recipes", json={"name": "Beans on toast", "ingredients": ["Beans"]}).json()

    response = client.delete(f"/recipes/{created_recipe['id']}")

    assert response.status_code == 204
    assert client.get(f"/recipes/{created_recipe['id']}").status_code == 404


def test_returns_uploaded_picture_when_getting_its_id(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    picture_id = client.post("/pictures", content=b"\xff\xd8\xff", headers={"Content-Type": "image/jpeg"}).json()["id"]

    response = client.get(f"/pictures/{picture_id}")

    assert response.status_code == 200
    assert response.content == b"\xff\xd8\xff"
    assert response.headers["Content-Type"] == "image/jpeg"


def test_lets_browsers_keep_picture_when_getting_it(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    picture_id = client.post("/pictures", content=b"\xff\xd8\xff", headers={"Content-Type": "image/jpeg"}).json()["id"]

    response = client.get(f"/pictures/{picture_id}")

    assert "immutable" in response.headers["Cache-Control"]


def test_returns_422_with_reason_when_uploading_file_that_is_not_an_image(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))

    response = client.post("/pictures", content=b"%PDF-1.7", headers={"Content-Type": "application/pdf"})

    assert response.status_code == 422
    assert response.json()["detail"] == "A recipe's picture must be a JPEG, PNG, WebP or GIF image."


def test_returns_404_when_getting_missing_picture(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))

    response = client.get(f"/pictures/{uuid7()}")

    assert response.status_code == 404


def test_returns_recipe_with_picture_when_creating_it_with_uploaded_picture(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    picture_id = client.post("/pictures", content=b"\x89PNG", headers={"Content-Type": "image/png"}).json()["id"]

    response = client.post("/recipes", json={"name": "Beans on toast", "ingredients": ["Beans"], "picture_id": picture_id})

    assert response.status_code == 201
    assert response.json()["picture_id"] == picture_id


def test_returns_422_with_reason_when_creating_recipe_with_missing_picture(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    picture_id = uuid7()

    response = client.post("/recipes", json={"name": "Beans on toast", "ingredients": ["Beans"], "picture_id": str(picture_id)})

    assert response.status_code == 422
    assert response.json()["detail"] == f"No picture has the id {picture_id}. Upload the picture first."


def test_deletes_picture_when_deleting_its_recipe(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "recipes.db"))
    picture_id = client.post("/pictures", content=b"\x89PNG", headers={"Content-Type": "image/png"}).json()["id"]
    recipe = {"name": "Beans on toast", "ingredients": ["Beans"], "picture_id": picture_id}
    recipe_id = client.post("/recipes", json=recipe).json()["id"]

    client.delete(f"/recipes/{recipe_id}")

    assert client.get(f"/pictures/{picture_id}").status_code == 404


def test_raises_when_database_path_is_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RECIPES_DATABASE_PATH", raising=False)

    with pytest.raises(KeyError):
        create_app_from_environment()
