from pathlib import Path
from uuid import uuid7

import pytest
from fastapi.testclient import TestClient

from reminders_api.api.create_app import create_app, create_app_from_environment


def test_returns_201_with_generated_id_when_creating_reminder(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    response = client.post("/reminders", json={"title": "Take out bins", "notes": "The blue one"})

    assert response.status_code == 201
    assert response.json()["id"]
    assert response.json()["title"] == "Take out bins"
    assert response.json()["notes"] == "The blue one"
    assert response.json()["due_at"] is None
    assert response.json()["completed_at"] is None


def test_returns_reminder_when_getting_created_id(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    created_reminder = client.post("/reminders", json={"title": "Take out bins"}).json()

    response = client.get(f"/reminders/{created_reminder['id']}")

    assert response.status_code == 200
    assert response.json() == created_reminder


def test_returns_404_when_getting_missing_reminder(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    response = client.get(f"/reminders/{uuid7()}")

    assert response.status_code == 404


def test_returns_422_when_id_is_malformed(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    response = client.get("/reminders/not-a-uuid")

    assert response.status_code == 422


def test_returns_empty_list_when_no_reminders_exist(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    response = client.get("/reminders")

    assert response.status_code == 200
    assert response.json() == []


def test_lists_oldest_reminder_first_when_several_exist(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    client.post("/reminders", json={"title": "Oldest"})
    client.post("/reminders", json={"title": "Newest"})

    response = client.get("/reminders")

    assert [reminder["title"] for reminder in response.json()] == ["Oldest", "Newest"]


def test_overwrites_every_field_when_replacing_reminder(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    created_reminder = client.post("/reminders", json={"title": "Take out bins", "notes": "The blue one"}).json()
    reminder_url = f"/reminders/{created_reminder['id']}"

    response = client.put(reminder_url, json={"title": "Take out recycling"})

    assert response.status_code == 200
    assert client.get(reminder_url).json() == {
        "id": created_reminder["id"],
        "title": "Take out recycling",
        "notes": None,
        "due_at": None,
        "completed_at": None,
    }


def test_creates_reminder_when_replacing_missing_id(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    reminder_url = f"/reminders/{uuid7()}"

    response = client.put(reminder_url, json={"title": "Take out bins"})

    assert response.status_code == 200
    assert client.get(reminder_url).json()["title"] == "Take out bins"


def test_returns_204_and_removes_reminder_when_deleting(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    created_reminder = client.post("/reminders", json={"title": "Take out bins"}).json()
    reminder_url = f"/reminders/{created_reminder['id']}"

    response = client.delete(reminder_url)

    assert response.status_code == 204
    assert client.get(reminder_url).status_code == 404


def test_returns_204_when_deleting_missing_reminder(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    response = client.delete(f"/reminders/{uuid7()}")

    assert response.status_code == 204


def test_returns_same_instant_in_utc_when_due_at_has_another_time_zone(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    create_response = client.post(
        "/reminders",
        json={"title": "Take out bins", "due_at": "2026-11-08T09:00:00+05:00"},
    )
    get_response = client.get(f"/reminders/{create_response.json()['id']}")

    assert create_response.json()["due_at"] == "2026-11-08T04:00:00Z"
    assert get_response.json()["due_at"] == "2026-11-08T04:00:00Z"


@pytest.mark.parametrize(
    "invalid_body",
    [
        {},
        {"title": ""},
        {"title": "   "},
        {"title": "Take out bins", "due_at": "2026-11-08T09:00:00"},
        {"title": "Take out bins", "completed_at": "2026-11-08T09:00:00"},
        {"title": "Take out bins", "due_at": "not a date"},
        {"title": "Take out bins", "id": "not-a-uuid"},
        {"title": "Take out bins", "due_date": "2026-11-08T09:00:00Z"},
    ],
)
def test_returns_422_and_saves_nothing_when_body_is_invalid(tmp_path: Path, invalid_body: dict[str, str]) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    response = client.post("/reminders", json=invalid_body)

    assert response.status_code == 422
    assert client.get("/reminders").json() == []


def test_keeps_existing_reminder_when_creating_with_its_id_in_body(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    existing_reminder = client.post("/reminders", json={"title": "Take out bins"}).json()

    response = client.post("/reminders", json={"title": "Overwrite attempt", "id": existing_reminder["id"]})

    assert response.status_code == 201
    assert response.json()["id"] != existing_reminder["id"]
    assert client.get(f"/reminders/{existing_reminder['id']}").json() == existing_reminder


def test_uses_id_from_url_when_replacing_with_different_id_in_body(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    url_id = str(uuid7())
    body_id = str(uuid7())

    response = client.put(f"/reminders/{url_id}", json={"title": "Take out bins", "id": body_id})

    assert response.json()["id"] == url_id
    assert client.get(f"/reminders/{body_id}").status_code == 404


def test_saves_edit_when_client_sends_back_reminder_it_received(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))
    received_reminder = client.post("/reminders", json={"title": "Take out bins"}).json()
    edited_reminder = received_reminder | {"title": "Take out recycling"}

    response = client.put(f"/reminders/{received_reminder['id']}", json=edited_reminder)

    assert response.status_code == 200
    assert response.json() == edited_reminder


def test_marks_only_title_as_required_when_generating_openapi_request_schema(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    openapi_schema = client.get("/openapi.json").json()

    request_schema = openapi_schema["components"]["schemas"]["ReminderSchema-Input"]
    assert request_schema["required"] == ["title"]


def test_marks_every_field_as_required_when_generating_openapi_response_schema(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "reminders.db"))

    openapi_schema = client.get("/openapi.json").json()

    response_schema = openapi_schema["components"]["schemas"]["ReminderSchema-Output"]
    assert set(response_schema["required"]) == {"id", "title", "notes", "due_at", "completed_at"}


def test_uses_database_from_environment_when_variable_is_set(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_path = tmp_path / "reminders.db"
    monkeypatch.setenv("REMINDERS_DATABASE_PATH", str(database_path))

    create_app_from_environment()

    assert database_path.exists()


def test_raises_key_error_when_database_variable_is_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("REMINDERS_DATABASE_PATH", raising=False)

    with pytest.raises(KeyError, match="REMINDERS_DATABASE_PATH"):
        create_app_from_environment()
