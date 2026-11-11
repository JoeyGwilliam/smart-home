from pathlib import Path
from typing import Any
from uuid import uuid7

import pytest
from fastapi.testclient import TestClient

from timers_api.api.create_app import create_app, create_app_from_environment


def test_returns_201_with_generated_id_when_creating_preset(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    breakfast_id = str(uuid7())
    shoes_id = str(uuid7())
    plan = {
        "name": "School run",
        "end_time": "08:35:00",
        "tasks": [
            {"id": breakfast_id, "name": "Breakfast", "duration_minutes": 25},
            {"id": shoes_id, "name": "Shoes on", "duration_minutes": 5},
        ],
        "faff_multiplier": 1.5,
    }

    response = client.post("/presets", json={"plan": plan})

    assert response.status_code == 201
    assert response.json()["id"]
    assert response.json()["plan"] == plan


def test_has_no_tasks_and_no_faffing_when_creating_with_only_name_and_end_time(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.post("/presets", json={"plan": {"name": "School run", "end_time": "08:35:00"}})

    assert response.json()["plan"]["tasks"] == []
    assert response.json()["plan"]["faff_multiplier"] == 1


def test_generates_task_id_when_creating_with_task_that_has_none(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    plan = {"name": "School run", "end_time": "08:35:00", "tasks": [{"name": "Breakfast", "duration_minutes": 25}]}

    response = client.post("/presets", json={"plan": plan})

    assert response.status_code == 201
    assert response.json()["plan"]["tasks"][0]["id"]


def test_accepts_end_time_when_it_has_no_seconds(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.post("/presets", json={"plan": {"name": "School run", "end_time": "08:35"}})

    assert response.status_code == 201
    assert response.json()["plan"]["end_time"] == "08:35:00"


def test_returns_preset_when_getting_created_id(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    created_preset = client.post("/presets", json={"plan": {"name": "School run", "end_time": "08:35:00"}}).json()

    response = client.get(f"/presets/{created_preset['id']}")

    assert response.status_code == 200
    assert response.json() == created_preset


def test_returns_404_when_getting_missing_preset(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.get(f"/presets/{uuid7()}")

    assert response.status_code == 404


def test_returns_422_when_id_is_malformed(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.get("/presets/not-a-uuid")

    assert response.status_code == 422


def test_returns_empty_list_when_no_presets_exist(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.get("/presets")

    assert response.status_code == 200
    assert response.json() == []


def test_lists_oldest_preset_first_when_several_exist(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    client.post("/presets", json={"plan": {"name": "Oldest", "end_time": "17:00:00"}})
    client.post("/presets", json={"plan": {"name": "Newest", "end_time": "17:00:00"}})

    response = client.get("/presets")

    assert [preset["plan"]["name"] for preset in response.json()] == ["Oldest", "Newest"]


def test_overwrites_every_field_when_replacing_preset(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    original_plan = {
        "name": "School run",
        "end_time": "08:35:00",
        "tasks": [{"name": "Breakfast", "duration_minutes": 25}],
        "faff_multiplier": 2,
    }
    created_preset = client.post("/presets", json={"plan": original_plan}).json()
    preset_url = f"/presets/{created_preset['id']}"

    response = client.put(preset_url, json={"plan": {"name": "Nursery run", "end_time": "09:00:00"}})

    assert response.status_code == 200
    assert client.get(preset_url).json() == {
        "id": created_preset["id"],
        "plan": {"name": "Nursery run", "end_time": "09:00:00", "tasks": [], "faff_multiplier": 1},
    }


def test_creates_preset_when_replacing_missing_id(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    preset_url = f"/presets/{uuid7()}"

    response = client.put(preset_url, json={"plan": {"name": "School run", "end_time": "08:35:00"}})

    assert response.status_code == 200
    assert client.get(preset_url).json()["plan"]["name"] == "School run"


def test_returns_204_and_removes_preset_when_deleting(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    created_preset = client.post("/presets", json={"plan": {"name": "School run", "end_time": "08:35:00"}}).json()
    preset_url = f"/presets/{created_preset['id']}"

    response = client.delete(preset_url)

    assert response.status_code == 204
    assert client.get(preset_url).status_code == 404


def test_returns_204_when_deleting_missing_preset(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.delete(f"/presets/{uuid7()}")

    assert response.status_code == 204


_SHARED_TASK_ID = str(uuid7())


@pytest.mark.parametrize(
    "invalid_plan",
    [
        {},
        {"name": "School run"},
        {"name": "School run", "end_time": "not a time"},
        {"name": "School run", "end_time": "08:35:00+01:00"},
        {"name": "School run", "end_time": "08:35:00", "faff_multiplier": 0.5},
        {"name": "School run", "end_time": "08:35:00", "tasks": [{"name": "Shoes on", "duration_minutes": 0}]},
        {"name": "School run", "end_time": "08:35:00", "tasks": [{"name": "Shoes on", "duration_minutes": 2.5}]},
        {"name": "School run", "end_time": "08:35:00", "tasks": [{"name": "Shoes on"}]},
        {"name": "School run", "end_time": "08:35:00", "tasks": [{"name": "Shoes on", "duration_minutes": 5, "id": "x"}]},
        {
            "name": "School run",
            "end_time": "08:35:00",
            "tasks": [
                {"name": "Breakfast", "duration_minutes": 25, "id": _SHARED_TASK_ID},
                {"name": "Shoes on", "duration_minutes": 5, "id": _SHARED_TASK_ID},
            ],
        },
        {"name": "School run", "end_time": "08:35:00", "ends_at": "08:35:00"},
    ],
)
def test_returns_422_and_saves_nothing_when_plan_is_invalid(tmp_path: Path, invalid_plan: dict[str, Any]) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    active_timer_before = client.get("/active-timer").json()

    preset_response = client.post("/presets", json={"plan": invalid_plan})
    active_timer_response = client.put("/active-timer", json={"plan": invalid_plan})

    assert preset_response.status_code == 422
    assert active_timer_response.status_code == 422
    assert client.get("/presets").json() == []
    assert client.get("/active-timer").json() == active_timer_before


@pytest.mark.parametrize(
    "invalid_body",
    [
        {},
        {"plan": {"name": "", "end_time": "08:35:00"}},
        {"plan": {"name": "   ", "end_time": "08:35:00"}},
        {"plan": {"name": "School run", "end_time": "08:35:00", "tasks": [{"name": " ", "duration_minutes": 5}]}},
        {"plan": {"name": "School run", "end_time": "08:35:00"}, "id": "not-a-uuid"},
        {"plan": {"name": "School run", "end_time": "08:35:00"}, "started_at": None},
    ],
)
def test_returns_422_and_saves_nothing_when_preset_is_invalid(tmp_path: Path, invalid_body: dict[str, Any]) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.post("/presets", json=invalid_body)

    assert response.status_code == 422
    assert client.get("/presets").json() == []


def test_keeps_existing_preset_when_creating_with_its_id_in_body(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    existing_preset = client.post("/presets", json={"plan": {"name": "School run", "end_time": "08:35:00"}}).json()

    response = client.post(
        "/presets",
        json={"plan": {"name": "Overwrite attempt", "end_time": "08:35:00"}, "id": existing_preset["id"]},
    )

    assert response.status_code == 201
    assert response.json()["id"] != existing_preset["id"]
    assert client.get(f"/presets/{existing_preset['id']}").json() == existing_preset


def test_uses_id_from_url_when_replacing_with_different_id_in_body(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    url_id = str(uuid7())
    body_id = str(uuid7())

    response = client.put(
        f"/presets/{url_id}",
        json={"plan": {"name": "School run", "end_time": "08:35:00"}, "id": body_id},
    )

    assert response.json()["id"] == url_id
    assert client.get(f"/presets/{body_id}").status_code == 404


def test_saves_edit_when_client_sends_back_preset_it_received(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    received_preset = client.post("/presets", json={"plan": {"name": "School run", "end_time": "08:35:00"}}).json()
    edited_preset = received_preset | {"plan": received_preset["plan"] | {"name": "Nursery run"}}

    response = client.put(f"/presets/{received_preset['id']}", json=edited_preset)

    assert response.status_code == 200
    assert response.json() == edited_preset


def test_returns_stopped_timer_with_empty_plan_when_no_active_timer_has_been_saved(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))

    response = client.get("/active-timer")

    assert response.status_code == 200
    assert response.json() == {
        "plan": {"name": "", "end_time": "17:00:00", "tasks": [], "faff_multiplier": 1},
        "started_at": None,
    }


def test_returns_saved_timer_when_getting_active_timer_after_replacing_it(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    active_timer = {
        "plan": {
            "name": "",
            "end_time": "08:35:00",
            "tasks": [{"id": str(uuid7()), "name": "", "duration_minutes": 25}],
            "faff_multiplier": 1.5,
        },
        "started_at": "2026-11-11T07:50:00Z",
    }

    put_response = client.put("/active-timer", json=active_timer)

    assert put_response.status_code == 200
    assert put_response.json() == active_timer
    assert client.get("/active-timer").json() == active_timer


def test_stops_active_timer_when_replacing_it_without_started_at(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    plan = {"name": "School run", "end_time": "08:35:00"}
    client.put("/active-timer", json={"plan": plan, "started_at": "2026-11-11T07:50:00Z"})

    client.put("/active-timer", json={"plan": plan})

    assert client.get("/active-timer").json()["started_at"] is None


def test_returns_same_instant_in_utc_when_started_at_has_another_time_zone(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    plan = {"name": "School run", "end_time": "08:35:00"}

    put_response = client.put("/active-timer", json={"plan": plan, "started_at": "2026-11-11T09:00:00+05:00"})

    assert put_response.json()["started_at"] == "2026-11-11T04:00:00Z"
    assert client.get("/active-timer").json()["started_at"] == "2026-11-11T04:00:00Z"


@pytest.mark.parametrize("invalid_started_at", ["2026-11-11T09:00:00", "not a date"])
def test_returns_422_when_replacing_active_timer_with_invalid_started_at(tmp_path: Path, invalid_started_at: str) -> None:
    client = TestClient(create_app(tmp_path / "timers.db"))
    plan = {"name": "School run", "end_time": "08:35:00"}

    response = client.put("/active-timer", json={"plan": plan, "started_at": invalid_started_at})

    assert response.status_code == 422


def test_uses_database_from_environment_when_variable_is_set(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_path = tmp_path / "timers.db"
    monkeypatch.setenv("TIMERS_DATABASE_PATH", str(database_path))

    create_app_from_environment()

    assert database_path.exists()


def test_raises_key_error_when_database_variable_is_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TIMERS_DATABASE_PATH", raising=False)

    with pytest.raises(KeyError, match="TIMERS_DATABASE_PATH"):
        create_app_from_environment()
