import time
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from shopper_api.api.create_app import create_app
from shopper_api.core.shopper import Shopper
from tests.core.test_shopper import MILK, FakeAccount, FakeAgent


def create_client(tmp_path: Path, **agent_options) -> TestClient:
    """ Creates a client of an API whose basket holds milk, and whose Claude and Morrisons are stand-ins. """
    account = FakeAccount()
    shopper = Shopper(lambda: (MILK,), account, FakeAgent(account, **agent_options), tmp_path / "status.json")
    return TestClient(create_app(shopper))


def wait_until_idle(client: TestClient) -> dict[str, Any]:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        status = client.get("/status").json()
        if status["state"] == "idle":
            return status
        time.sleep(0.01)
    raise TimeoutError("The API stayed busy.")


def test_returns_idle_status_when_nothing_has_been_done(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.get("/status")

    assert response.status_code == 200
    assert response.json() == {"state": "idle", "is_logged_in": False, "login_failure": None, "trip": None}


def test_returns_202_and_finishes_with_draft_order_when_starting_trip(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.post("/trip", json={"model": "opus", "effort": "high"})

    assert response.status_code == 202
    trip = wait_until_idle(client)["trip"]
    assert (trip["model"], trip["effort"]) == ("opus", "high")
    assert trip["draft_order"]["item_choices"] == [{"item": "Milk", "products": ["1 × Morrisons Milk 2L"], "note": "Cheapest."}]
    assert trip["draft_order"]["trolley"] == {
        "lines": [{"name": "Morrisons Milk 2L", "quantity": 1, "price": "1.55", "offer": None}],
        "total": "1.55",
        "savings": "0",
        "shortfall_to_minimum_spend": "23.45",
    }


def test_shops_with_sonnet_at_medium_effort_when_trip_names_neither(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    client.post("/trip", json={})

    trip = wait_until_idle(client)["trip"]
    assert (trip["model"], trip["effort"]) == ("sonnet", "medium")


def test_returns_422_when_model_is_unknown(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.post("/trip", json={"model": "gpt"})

    assert response.status_code == 422


def test_returns_409_with_reason_when_starting_trip_while_one_is_under_way(tmp_path: Path) -> None:
    client = create_client(tmp_path, waits_to_be_stopped=True)
    client.post("/trip", json={})

    response = client.post("/trip", json={})

    assert response.status_code == 409
    assert "under way" in response.json()["detail"]
    client.post("/trip/stop")


def test_is_logged_in_when_person_logs_in(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.post("/account/log-in")

    assert response.status_code == 202
    assert wait_until_idle(client)["is_logged_in"]


def test_is_not_logged_in_when_logging_out(tmp_path: Path) -> None:
    client = create_client(tmp_path)
    client.post("/account/log-in")
    wait_until_idle(client)

    response = client.post("/account/log-out")

    assert response.status_code == 204
    assert not client.get("/status").json()["is_logged_in"]
