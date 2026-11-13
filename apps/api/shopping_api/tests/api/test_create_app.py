from pathlib import Path
from uuid import uuid7

import pytest
from fastapi.testclient import TestClient

from shopping_api.api.create_app import create_app, create_app_from_environment


def test_returns_empty_basket_when_nothing_has_been_added(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))

    response = client.get("/basket")

    assert response.status_code == 200
    assert response.json() == {"lines": [], "shopping_list": []}


def test_returns_basket_with_line_and_shopping_list_when_adding_a_recipe(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))
    recipe_id = str(uuid7())

    response = client.post("/basket/lines", json={"name": "Chilli", "recipe": {"id": recipe_id, "ingredients": ["Beans", "Rice"]}})

    assert response.status_code == 200
    [line] = response.json()["lines"]
    assert {key: value for key, value in line.items() if key != "id"} == {
        "name": "Chilli",
        "quantity": 1,
        "recipe": {"id": recipe_id, "ingredients": ["Beans", "Rice"]},
    }
    assert response.json()["shopping_list"] == [
        {"name": "Beans", "quantity": 1, "needed_for": ["Chilli"]},
        {"name": "Rice", "quantity": 1, "needed_for": ["Chilli"]},
    ]


def test_counts_both_when_adding_the_same_recipe_twice(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))
    chilli = {"name": "Chilli", "recipe": {"id": str(uuid7()), "ingredients": ["Beans"]}}
    client.post("/basket/lines", json=chilli)

    response = client.post("/basket/lines", json=chilli)

    assert [line["quantity"] for line in response.json()["lines"]] == [2]


def test_returns_422_when_adding_an_item_without_a_name(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))

    response = client.post("/basket/lines", json={"name": " "})

    assert response.status_code == 422


def test_raises_quantity_when_changing_it_by_one(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))
    line_id = client.post("/basket/lines", json={"name": "Milk", "quantity": 2}).json()["lines"][0]["id"]

    response = client.patch(f"/basket/lines/{line_id}", json={"quantity_change": 1})

    assert response.json()["lines"][0]["quantity"] == 3


def test_takes_line_out_when_lowering_its_quantity_to_zero(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))
    line_id = client.post("/basket/lines", json={"name": "Milk"}).json()["lines"][0]["id"]

    response = client.patch(f"/basket/lines/{line_id}", json={"quantity_change": -1})

    assert response.json()["lines"] == []


def test_takes_only_that_line_out_when_removing_it(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))
    milk_id = client.post("/basket/lines", json={"name": "Milk", "quantity": 4}).json()["lines"][0]["id"]
    client.post("/basket/lines", json={"name": "Bread"})

    response = client.delete(f"/basket/lines/{milk_id}")

    assert [line["name"] for line in response.json()["lines"]] == ["Bread"]


def test_returns_empty_basket_when_emptying_it(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "shopping.db"))
    client.post("/basket/lines", json={"name": "Milk"})

    response = client.delete("/basket/lines")

    assert response.json() == {"lines": [], "shopping_list": []}
    assert client.get("/basket").json() == {"lines": [], "shopping_list": []}


def test_raises_when_database_path_is_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SHOPPING_DATABASE_PATH", raising=False)

    with pytest.raises(KeyError):
        create_app_from_environment()
