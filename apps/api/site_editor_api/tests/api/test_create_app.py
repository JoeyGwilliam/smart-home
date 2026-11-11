import sys
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from site_editor_api.api.create_app import create_app, create_app_from_environment
from site_editor_api.core.site_checkout import SiteCheckout
from site_editor_api.core.site_editor import SiteEditor
from tests.fake_claude import create_fake_claude, read_fake_claude_calls
from tests.git_repository import create_repository

SUCCEED = (sys.executable, "-c", "pass")

CLAUDE_SAYS_BIGGER_CLOCK = {"type": "assistant", "message": {"content": [{"type": "text", "text": "make the clock bigger"}]}}
FINISHED = {"type": "result", "is_error": False}


def create_client(tmp_path: Path, claude_command: tuple[str, ...] = ("claude",)) -> TestClient:
    """ Creates a client of an API that edits a new repository at `tmp_path / "site"`, whose rebuilds do nothing. """
    create_repository(tmp_path / "site")
    checkout = SiteCheckout(tmp_path / "site", rebuild_command=SUCCEED)
    return TestClient(create_app(checkout, SiteEditor(checkout, tmp_path / "state.json", claude_command)))


def wait_until_not_busy(client: TestClient) -> dict[str, Any]:
    """ Waits for the API's background work to finish, and returns the change as it then stands. """
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        change = client.get("/change").json()
        if change["state"] not in ("working", "building", "saving"):
            return change
        time.sleep(0.02)
    raise TimeoutError("The API stayed busy.")


def test_returns_idle_change_when_nothing_has_been_asked(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.get("/change")

    assert response.status_code == 200
    assert response.json() == {"state": "idle", "events": [], "changed_files": []}


def test_returns_202_and_previews_change_when_sending_message(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    client = create_client(tmp_path, claude_command)

    response = client.post("/change/messages", json={"text": "Make the clock bigger"})

    assert response.status_code == 202
    change = wait_until_not_busy(client)
    assert change["state"] == "reviewing"
    assert change["changed_files"] == ["index.html"]
    assert change["events"][:2] == [
        {"kind": "request", "text": "Make the clock bigger"},
        {"kind": "reply", "text": "make the clock bigger"},
    ]


def test_returns_422_when_message_is_blank(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.post("/change/messages", json={"text": "   "})

    assert response.status_code == 422


def test_returns_409_with_reason_when_sending_message_while_busy(tmp_path: Path) -> None:
    client = create_client(tmp_path, create_fake_claude(tmp_path, [], hangs=True))
    client.post("/change/messages", json={"text": "Make the clock bigger"})

    response = client.post("/change/messages", json={"text": "And make it pink"})

    assert response.status_code == 409
    assert "busy" in response.json()["detail"]
    client.post("/change/stop")


def test_returns_204_and_stops_claude_when_stopping(tmp_path: Path) -> None:
    client = create_client(tmp_path, create_fake_claude(tmp_path, [], hangs=True))
    client.post("/change/messages", json={"text": "Make the clock bigger"})

    response = client.post("/change/stop")

    assert response.status_code == 204
    assert wait_until_not_busy(client)["state"] == "discussing"


def test_returns_202_and_saves_change_when_confirming(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    client = create_client(tmp_path, claude_command)
    client.post("/change/messages", json={"text": "Make the clock bigger"})
    wait_until_not_busy(client)

    response = client.post("/change/confirm")

    assert response.status_code == 202
    assert wait_until_not_busy(client)["state"] == "idle"
    assert client.get("/commits").json()[0]["subject"] == "make the clock bigger"


def test_returns_409_when_confirming_with_nothing_to_review(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.post("/change/confirm")

    assert response.status_code == 409


def test_returns_202_and_restores_files_when_discarding(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, [FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    client = create_client(tmp_path, claude_command)
    client.post("/change/messages", json={"text": "Make the clock bigger"})
    wait_until_not_busy(client)

    response = client.post("/change/discard")

    assert response.status_code == 202
    assert wait_until_not_busy(client)["state"] == "idle"
    assert (tmp_path / "site" / "index.html").read_text(encoding="utf-8") == "<h1>Home</h1>"


def test_returns_commits_with_all_fields_when_listing_history(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.get("/commits")

    assert response.status_code == 200
    [commit] = response.json()
    assert commit["subject"] == "first commit"
    assert commit["author"] == "Test Author"
    assert len(commit["hash"]) == 40
    assert commit["committed_at"]


def test_returns_422_when_commit_limit_is_not_positive(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.get("/commits", params={"limit": 0})

    assert response.status_code == 422


def test_returns_page_that_can_discard_when_getting_rescue_page(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.get("/rescue")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "change/discard" in response.text


def test_edits_repository_named_by_environment_when_created_from_it(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    create_repository(tmp_path / "site")
    monkeypatch.setenv("SITE_EDITOR_REPOSITORY_PATH", str(tmp_path / "site"))
    monkeypatch.setenv("SITE_EDITOR_STATE_PATH", str(tmp_path / "state" / "change.json"))

    client = TestClient(create_app_from_environment())

    assert client.get("/commits").json()[0]["subject"] == "first commit"
    assert (tmp_path / "state").is_dir()


def test_raises_key_error_when_environment_names_no_repository(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SITE_EDITOR_REPOSITORY_PATH", raising=False)
    monkeypatch.setenv("SITE_EDITOR_STATE_PATH", str(tmp_path / "change.json"))

    with pytest.raises(KeyError):
        create_app_from_environment()


def test_has_claude_use_model_and_effort_when_message_names_them(tmp_path: Path) -> None:
    client = create_client(tmp_path, create_fake_claude(tmp_path, [FINISHED]))

    response = client.post("/change/messages", json={"text": "Make the clock bigger", "model": "haiku", "effort": "max"})

    assert response.status_code == 202
    wait_until_not_busy(client)
    [call] = read_fake_claude_calls(tmp_path)
    assert call["arguments"][call["arguments"].index("--model") + 1] == "haiku"
    assert call["arguments"][call["arguments"].index("--effort") + 1] == "max"


def test_returns_422_when_message_names_unknown_model(tmp_path: Path) -> None:
    client = create_client(tmp_path)

    response = client.post("/change/messages", json={"text": "Make the clock bigger", "model": "gpt"})

    assert response.status_code == 422
