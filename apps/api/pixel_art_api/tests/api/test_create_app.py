from pathlib import Path
from uuid import uuid7

import pytest
from fastapi.testclient import TestClient

from pixel_art_api.api.create_app import create_app, create_app_from_environment

SUN_JSON = {
    "variants": [{"name": "Midday", "palette": {"o": "#ffd94a"}, "frames": [{"rows": [".o.", "ooo"], "milliseconds": 200}]}],
    "title": None,
}

PLACEMENT_JSON = {
    "id": "snowman-1",
    "picture_id": "snowman",
    "x": 48,
    "anchor": "bottom",
    "y": 24,
    "pixel_size": 4,
    "variant": "",
    "spread": "none",
    "opacity": 100,
    "is_flipped": False,
    "motion": "none",
}

LAYER_JSON = {"name": "Snowman", "placements": [PLACEMENT_JSON]}

SCENE_JSON = {"name": "Christmas", "time_of_day": "night", "weather": "snow", "layer_ids": ["sky", "custom-snowman"]}


def test_returns_no_pictures_when_none_have_been_saved(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.get("/pictures")

    assert response.status_code == 200
    assert response.json() == {}


def test_lists_picture_under_its_id_when_it_has_been_saved(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    save_response = client.put("/pictures/sun", json=SUN_JSON)

    assert save_response.status_code == 200
    assert save_response.json() == SUN_JSON
    assert client.get("/pictures").json() == {"sun": SUN_JSON}


def test_returns_422_when_picture_breaks_the_rules(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    variant = {"name": "Midday", "palette": {"o": "#ffd94a"}, "frames": [{"rows": ["ox"], "milliseconds": 200}]}

    response = client.put("/pictures/sun", json={"variants": [variant], "title": None})

    assert response.status_code == 422


def test_returns_422_when_picture_id_has_characters_that_are_not_allowed(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.put("/pictures/Midday Sun", json=SUN_JSON)

    assert response.status_code == 422


def test_lists_no_picture_when_it_has_been_deleted(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    client.put("/pictures/sun", json=SUN_JSON)

    response = client.delete("/pictures/sun")

    assert response.status_code == 204
    assert client.get("/pictures").json() == {}


def test_uses_database_named_by_environment_when_created_from_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_path = tmp_path / "pixel_art.db"
    monkeypatch.setenv("PIXEL_ART_DATABASE_PATH", str(database_path))
    TestClient(create_app(database_path)).put("/pictures/sun", json=SUN_JSON)

    response = TestClient(create_app_from_environment()).get("/pictures")

    assert response.json() == {"sun": SUN_JSON}


def test_lists_scene_under_its_id_when_it_has_been_saved(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    save_response = client.put("/scenes/custom-christmas", json=SCENE_JSON)

    assert save_response.status_code == 200
    assert save_response.json() == SCENE_JSON
    assert client.get("/scenes").json() == {"custom-christmas": SCENE_JSON}


def test_returns_422_when_scene_breaks_the_rules(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.put("/scenes/custom-christmas", json={**SCENE_JSON, "name": " "})

    assert response.status_code == 422


def test_returns_422_when_placement_breaks_the_rules(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.put("/layers/custom-snowman", json={**LAYER_JSON, "placements": [{**PLACEMENT_JSON, "opacity": 101}]})

    assert response.status_code == 422


def test_lists_no_scene_when_it_has_been_deleted(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    client.put("/scenes/custom-christmas", json=SCENE_JSON)

    response = client.delete("/scenes/custom-christmas")

    assert response.status_code == 204
    assert client.get("/scenes").json() == {}


def test_lists_layer_under_its_id_when_it_has_been_saved(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    save_response = client.put("/layers/custom-snowman", json=LAYER_JSON)

    assert save_response.status_code == 200
    assert save_response.json() == LAYER_JSON
    assert client.get("/layers").json() == {"custom-snowman": LAYER_JSON}


def test_returns_422_when_scene_uses_a_layer_twice(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.put("/scenes/custom-christmas", json={**SCENE_JSON, "layer_ids": ["sky", "sky"]})

    assert response.status_code == 422


def test_lists_no_layer_when_it_has_been_deleted(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    client.put("/layers/custom-snowman", json=LAYER_JSON)

    response = client.delete("/layers/custom-snowman")

    assert response.status_code == 204
    assert client.get("/layers").json() == {}


def test_lists_the_site_preset_when_nothing_has_been_saved(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.get("/presets")

    assert [preset["name"] for preset in response.json()] == ["The site's own design"]


def test_lists_preset_by_name_when_it_has_been_saved(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    save_response = client.post("/presets", json={"name": "Winter"})

    assert save_response.status_code == 201
    assert save_response.json()["name"] == "Winter"
    assert client.get("/presets").json()[-1] == save_response.json()


def test_returns_422_when_preset_name_is_blank(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.post("/presets", json={"name": " "})

    assert response.status_code == 422


def test_puts_back_what_was_saved_when_a_preset_is_applied(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    client.put("/pictures/sun", json=SUN_JSON)
    preset_id = client.post("/presets", json={"name": "Summer"}).json()["id"]
    client.delete("/pictures/sun")
    client.put("/scenes/custom-christmas", json=SCENE_JSON)

    response = client.post(f"/presets/{preset_id}/apply")

    assert response.status_code == 204
    assert client.get("/pictures").json() == {"sun": SUN_JSON}
    assert client.get("/scenes").json() == {}


def test_returns_409_when_applying_a_preset_that_does_not_exist(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.post(f"/presets/{uuid7()}/apply")

    assert response.status_code == 409


def test_holds_the_design_as_it_is_now_when_a_preset_is_saved_over(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    [site_preset] = client.get("/presets").json()
    client.put("/pictures/sun", json=SUN_JSON)

    response = client.post(f"/presets/{site_preset['id']}/overwrite")
    client.delete("/pictures/sun")
    client.post(f"/presets/{site_preset['id']}/apply")

    assert response.status_code == 204
    assert client.get("/pictures").json() == {"sun": SUN_JSON}


def test_returns_the_renamed_preset_when_a_preset_is_renamed(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    preset_id = client.post("/presets", json={"name": "Summer"}).json()["id"]

    response = client.patch(f"/presets/{preset_id}", json={"name": "Midsummer"})

    assert response.status_code == 200
    assert response.json()["name"] == "Midsummer"


def test_returns_409_when_renaming_a_preset_that_does_not_exist(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))

    response = client.patch(f"/presets/{uuid7()}", json={"name": "Midsummer"})

    assert response.status_code == 409


def test_lists_no_preset_when_it_has_been_deleted(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "pixel_art.db"))
    preset_id = client.post("/presets", json={"name": "Summer"}).json()["id"]

    response = client.delete(f"/presets/{preset_id}")

    assert response.status_code == 204
    assert preset_id not in [preset["id"] for preset in client.get("/presets").json()]
