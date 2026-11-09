import json
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from kiosk_viewer_python.create_app import create_app, create_app_from_environment
from kiosk_viewer_python.reminders_client import RemindersClient

REMINDER_ID = "019a6f2e-7c41-7d3a-9b12-4f8e2a6c1d90"
LONDON = ZoneInfo("Europe/London")


def test_shows_due_time_in_viewer_time_zone_when_listing_reminders() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[{
        "id": REMINDER_ID,
        "title": "Summer reminder",
        "notes": None,
        "due_at": "2099-07-01T08:00:00Z",
        "completed_at": None,
    }]))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert response.status_code == 200
    assert "Wed 1 Jul, 09:00" in response.text
    assert "Overdue" not in response.text


def test_marks_reminder_as_overdue_when_due_time_has_passed() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[{
        "id": REMINDER_ID,
        "title": "Old reminder",
        "notes": None,
        "due_at": "2020-01-01T08:00:00Z",
        "completed_at": None,
    }]))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert "Overdue" in response.text


def test_does_not_mark_reminder_as_overdue_when_it_is_completed() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[{
        "id": REMINDER_ID,
        "title": "Old reminder",
        "notes": None,
        "due_at": "2020-01-01T08:00:00Z",
        "completed_at": "2020-01-01T07:00:00Z",
    }]))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert "Done" in response.text
    assert "Overdue" not in response.text


def test_lists_soonest_reminder_first_and_undated_reminder_last_when_listing() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[
        {"id": REMINDER_ID, "title": "No due time", "notes": None, "due_at": None, "completed_at": None},
        {"id": REMINDER_ID, "title": "Later", "notes": None, "due_at": "2099-02-01T08:00:00Z", "completed_at": None},
        {"id": REMINDER_ID, "title": "Sooner", "notes": None, "due_at": "2099-01-01T08:00:00Z", "completed_at": None},
    ]))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert response.text.index("Sooner") < response.text.index("Later") < response.text.index("No due time")


def test_escapes_html_when_reminder_title_contains_markup() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[{
        "id": REMINDER_ID,
        "title": "<script>alert('hi')</script>",
        "notes": None,
        "due_at": None,
        "completed_at": None,
    }]))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert "<script>" not in response.text


def test_sends_due_time_with_uk_summer_offset_when_adding_reminder() -> None:
    saved_bodies = []

    def respond(request: httpx.Request) -> httpx.Response:
        saved_bodies.append(json.loads(request.content))
        return httpx.Response(201, json={})

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app, follow_redirects=False).post(
        "/reminders",
        data={"title": "Take out bins", "notes": "  ", "due_at": "2099-07-01T09:00"},
    )

    assert response.status_code == 303
    assert response.headers["location"] == "/"
    assert saved_bodies == [{
        "title": "Take out bins",
        "notes": None,
        "due_at": "2099-07-01T09:00:00+01:00",
        "completed_at": None,
    }]


def test_shows_error_and_keeps_entered_values_when_api_rejects_reminder() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422) if request.method == "POST" else httpx.Response(200, json=[])

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app).post("/reminders", data={"title": "   ", "notes": "Keep these notes"})

    assert response.status_code == 422
    assert "couldn't be saved" in response.text
    assert "Keep these notes" in response.text


def test_shows_error_and_saves_nothing_when_due_time_is_malformed() -> None:
    methods = []

    def respond(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(200, json=[])

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app).post("/reminders", data={"title": "Take out bins", "due_at": "not a time"})

    assert response.status_code == 422
    assert "POST" not in methods


def test_sends_nothing_destructive_when_showing_delete_confirmation() -> None:
    methods = []

    def respond(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(200, json={
            "id": REMINDER_ID,
            "title": "Take out bins",
            "notes": None,
            "due_at": None,
            "completed_at": None,
        })

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app).get(f"/reminders/{REMINDER_ID}/delete")

    assert response.status_code == 200
    assert "Delete this reminder?" in response.text
    assert "Take out bins" in response.text
    assert methods == ["GET"]


def test_returns_to_reminders_when_confirming_deletion_of_missing_reminder() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(404))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app, follow_redirects=False).get(f"/reminders/{REMINDER_ID}/delete")

    assert response.status_code == 303
    assert response.headers["location"] == "/"


def test_deletes_reminder_when_deletion_is_confirmed() -> None:
    requests = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path))
        return httpx.Response(204)

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app, follow_redirects=False).post(f"/reminders/{REMINDER_ID}/delete")

    assert response.status_code == 303
    assert requests == [("DELETE", f"/reminders/{REMINDER_ID}")]


def test_saves_change_and_returns_to_reminders_when_toggling() -> None:
    methods = []

    def respond(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(200, json={
            "id": REMINDER_ID,
            "title": "Take out bins",
            "notes": None,
            "due_at": None,
            "completed_at": None,
        })

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app, follow_redirects=False).post(f"/reminders/{REMINDER_ID}/toggle")

    assert response.status_code == 303
    assert methods == ["GET", "PUT"]


def test_shows_unavailable_page_when_api_cannot_be_reached() -> None:
    def fail_to_connect(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(fail_to_connect), base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert response.status_code == 503
    assert "Can't reach your reminders" in response.text


def test_creates_app_when_environment_variables_are_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REMINDERS_API_URL", "http://reminders-api:8000")
    monkeypatch.setenv("KIOSK_TIME_ZONE", "Europe/London")

    app = create_app_from_environment()

    assert isinstance(app, FastAPI)


def test_raises_key_error_when_api_url_is_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("REMINDERS_API_URL", raising=False)
    monkeypatch.setenv("KIOSK_TIME_ZONE", "Europe/London")

    with pytest.raises(KeyError, match="REMINDERS_API_URL"):
        create_app_from_environment()


def _render_page(now: datetime, due_at: datetime, completed_at: datetime | None = None) -> str:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[{
        "id": REMINDER_ID,
        "title": "Take out bins",
        "notes": None,
        "due_at": due_at.isoformat(),
        "completed_at": completed_at.isoformat() if completed_at else None,
    }]))
    reminders_client = RemindersClient(httpx.Client(transport=api_transport, base_url="http://api"))
    app = create_app(reminders_client, LONDON, get_current_time=lambda: now)
    return TestClient(app).get("/").text


def test_shows_days_when_due_on_a_later_day() -> None:
    page = _render_page(now=datetime(2026, 11, 8, 12, 0, tzinfo=LONDON), due_at=datetime(2026, 11, 11, 9, 0, tzinfo=LONDON))

    assert '<span class="countdown__value">3</span>' in page
    assert '<span class="countdown__caption">days</span>' in page
    assert "Due today" not in page
    assert "Overdue" not in page


def test_shows_one_day_when_due_just_after_next_midnight() -> None:
    page = _render_page(now=datetime(2026, 11, 8, 23, 55, tzinfo=LONDON), due_at=datetime(2026, 11, 9, 0, 5, tzinfo=LONDON))

    assert '<span class="countdown__value">1</span>' in page
    assert '<span class="countdown__caption">day</span>' in page
    assert "Due today" not in page


def test_shows_hours_and_due_today_status_when_due_later_today() -> None:
    page = _render_page(now=datetime(2026, 11, 8, 12, 0, tzinfo=LONDON), due_at=datetime(2026, 11, 8, 15, 40, tzinfo=LONDON))

    assert '<span class="countdown__value">3</span>' in page
    assert '<span class="countdown__caption">hours</span>' in page
    assert "Due today · " in page
    assert "reminder--due-today" in page
    assert "Overdue" not in page


def test_shows_singular_hour_when_due_in_just_over_an_hour() -> None:
    page = _render_page(now=datetime(2026, 11, 8, 12, 0, tzinfo=LONDON), due_at=datetime(2026, 11, 8, 13, 30, tzinfo=LONDON))

    assert '<span class="countdown__value">1</span>' in page
    assert '<span class="countdown__caption">hour</span>' in page


def test_shows_less_than_one_hour_when_due_within_the_hour() -> None:
    page = _render_page(now=datetime(2026, 11, 8, 12, 0, tzinfo=LONDON), due_at=datetime(2026, 11, 8, 12, 20, tzinfo=LONDON))

    assert '<span class="countdown__value">&lt;1</span>' in page
    assert '<span class="countdown__caption">hour</span>' in page
    assert "Due today · " in page


def test_marks_as_overdue_and_shows_hours_ago_when_due_time_earlier_today_has_passed() -> None:
    page = _render_page(now=datetime(2026, 11, 8, 12, 0, tzinfo=LONDON), due_at=datetime(2026, 11, 8, 9, 30, tzinfo=LONDON))

    assert '<span class="countdown__value">2</span>' in page
    assert '<span class="countdown__caption">hours ago</span>' in page
    assert "Overdue · " in page
    assert "reminder--overdue" in page
    assert "Due today" not in page


def test_shows_days_ago_when_due_on_an_earlier_day() -> None:
    page = _render_page(now=datetime(2026, 11, 8, 12, 0, tzinfo=LONDON), due_at=datetime(2026, 11, 6, 15, 0, tzinfo=LONDON))

    assert '<span class="countdown__value">2</span>' in page
    assert '<span class="countdown__caption">days ago</span>' in page
    assert "Overdue · " in page


def test_counts_hours_correctly_when_time_is_in_uk_summer_time() -> None:
    page = _render_page(now=datetime(2026, 7, 1, 11, 0, tzinfo=UTC), due_at=datetime(2026, 7, 1, 15, 0, tzinfo=LONDON))

    assert '<span class="countdown__value">3</span>' in page
    assert '<span class="countdown__caption">hours</span>' in page


def test_shows_no_status_when_reminder_due_today_is_completed() -> None:
    page = _render_page(
        now=datetime(2026, 11, 8, 12, 0, tzinfo=LONDON),
        due_at=datetime(2026, 11, 8, 15, 0, tzinfo=LONDON),
        completed_at=datetime(2026, 11, 8, 11, 0, tzinfo=LONDON),
    )

    assert "Due today" not in page
    assert "Overdue" not in page
    assert "reminder--due-today" not in page


def test_plays_chime_only_for_reminders_not_yet_completed_when_listing() -> None:
    now = datetime(2026, 11, 8, 12, 0, tzinfo=LONDON)
    due_at = datetime(2026, 11, 9, 12, 0, tzinfo=LONDON)

    active_page = _render_page(now, due_at)
    completed_page = _render_page(now, due_at, completed_at=now)

    assert "data-completes-reminder" in active_page
    assert "data-completes-reminder" not in completed_page


def test_shows_no_countdown_when_reminder_has_no_due_time() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[
        {"id": REMINDER_ID, "title": "Buy coffee", "notes": None, "due_at": None, "completed_at": None},
    ]))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert 'class="countdown"' not in response.text


def test_lists_completed_reminders_by_due_date_when_several_are_done() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json=[
        {"id": REMINDER_ID, "title": "No due time", "notes": None, "due_at": None, "completed_at": "2099-01-01T08:00:00Z"},
        {"id": REMINDER_ID, "title": "Later", "notes": None, "due_at": "2099-02-01T08:00:00Z", "completed_at": "2099-01-01T08:00:00Z"},
        {"id": REMINDER_ID, "title": "Sooner", "notes": None, "due_at": "2099-01-01T08:00:00Z", "completed_at": "2099-01-01T08:00:00Z"},
    ]))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get("/")

    assert response.text.index("Sooner") < response.text.index("Later") < response.text.index("No due time")


def test_fills_form_with_current_values_in_viewer_time_zone_when_showing_edit_page() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(200, json={
        "id": REMINDER_ID,
        "title": "Take out bins",
        "notes": "The blue one",
        "due_at": "2099-07-01T08:00:00Z",
        "completed_at": None,
    }))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app).get(f"/reminders/{REMINDER_ID}/edit")

    assert response.status_code == 200
    assert 'value="Take out bins"' in response.text
    assert 'value="The blue one"' in response.text
    assert 'value="2099-07-01T09:00"' in response.text


def test_returns_to_reminders_when_editing_missing_reminder() -> None:
    api_transport = httpx.MockTransport(lambda _: httpx.Response(404))
    app = create_app(RemindersClient(httpx.Client(transport=api_transport, base_url="http://api")), LONDON)

    response = TestClient(app, follow_redirects=False).get(f"/reminders/{REMINDER_ID}/edit")

    assert response.status_code == 303
    assert response.headers["location"] == "/"


def test_saves_changes_and_returns_to_reminders_when_edit_is_submitted() -> None:
    saved_bodies = []

    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={
                "id": REMINDER_ID,
                "title": "Take out bins",
                "notes": "The blue one",
                "due_at": None,
                "completed_at": None,
            })
        saved_bodies.append(json.loads(request.content))
        return httpx.Response(200, json={})

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app, follow_redirects=False).post(
        f"/reminders/{REMINDER_ID}/edit",
        data={"title": "Take out recycling", "notes": "", "due_at": "2099-07-01T09:00"},
    )

    assert response.status_code == 303
    assert saved_bodies == [{
        "title": "Take out recycling",
        "notes": None,
        "due_at": "2099-07-01T09:00:00+01:00",
        "completed_at": None,
    }]


def test_shows_error_and_keeps_entered_values_when_edit_is_rejected() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={
                "id": REMINDER_ID,
                "title": "Take out bins",
                "notes": None,
                "due_at": None,
                "completed_at": None,
            })
        return httpx.Response(422)

    app = create_app(RemindersClient(httpx.Client(transport=httpx.MockTransport(respond), base_url="http://api")), LONDON)

    response = TestClient(app).post(
        f"/reminders/{REMINDER_ID}/edit",
        data={"title": "   ", "notes": "Keep these notes", "due_at": "2099-07-01T09:00"},
    )

    assert response.status_code == 422
    assert "couldn't be saved" in response.text
    assert 'value="Keep these notes"' in response.text
    assert 'value="2099-07-01T09:00"' in response.text
