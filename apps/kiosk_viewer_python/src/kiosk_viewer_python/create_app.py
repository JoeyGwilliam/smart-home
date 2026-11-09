import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, tzinfo
from pathlib import Path
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, FastAPI, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from kiosk_viewer_python.reminders_client import (
    InvalidReminderError,
    Reminder,
    RemindersClient,
    RemindersUnavailableError,
)

_PACKAGE_DIRECTORY = Path(__file__).parent
_API_TIMEOUT_SECONDS = 5

_templates = Jinja2Templates(directory=_PACKAGE_DIRECTORY / "templates")


def _get_real_time() -> datetime:
    return datetime.now(UTC)


def create_app(
    reminders_client: RemindersClient,
    time_zone: tzinfo,
    get_current_time: Callable[[], datetime] = _get_real_time,
) -> FastAPI:
    """ Creates the kiosk viewer.

    Args:
        reminders_client:
            Client for the reminders API, which holds all of the data.
        time_zone:
            Time zone used to display due times and to interpret due times that users enter.
        get_current_time:
            Returns the current timezone-aware time. Defaults to the real time.

    Returns:
        The viewer, ready to be served.
    """
    app = FastAPI(title="Kiosk Viewer")
    app.state.reminders_client = reminders_client
    app.state.time_zone = time_zone
    app.state.get_current_time = get_current_time
    app.mount("/static", StaticFiles(directory=_PACKAGE_DIRECTORY / "static"), name="static")
    app.add_exception_handler(RemindersUnavailableError, _render_unavailable_page)
    app.include_router(_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the kiosk viewer, configured by the environment.

    Reads the reminders API's address from `REMINDERS_API_URL`, and the IANA time zone name from `KIOSK_TIME_ZONE`.

    Returns:
        The viewer, ready to be served.

    Raises:
        KeyError: If either environment variable is not set.
    """
    http_client = httpx.Client(base_url=os.environ["REMINDERS_API_URL"], timeout=_API_TIMEOUT_SECONDS)
    return create_app(RemindersClient(http_client), ZoneInfo(os.environ["KIOSK_TIME_ZONE"]))


@dataclass(frozen=True)
class _Countdown:
    """ What a template needs to display how far away a reminder's due time is.

    Attributes:
        value:
            The prominent text, such as "3" or "<1".
        caption:
            The text beneath the value, such as "hours" or "days ago".
    """
    value: str
    caption: str


@dataclass(frozen=True)
class _ReminderView:
    """ What a template needs to display a reminder.

    Attributes:
        id:
            Unique identifier of the reminder.
        title:
            Short description of the reminder.
        notes:
            Optional longer details.
        due_label:
            Due time in the viewer's time zone, ready to display, or None if there is no due time.
        countdown:
            How far away the due time is, or None if there is no due time.
        is_overdue:
            Whether the reminder's due time has passed without it being completed.
        is_due_today:
            Whether the reminder's due time is later today, without it being completed.
        is_completed:
            Whether the reminder has been completed.
    """
    id: UUID
    title: str
    notes: str | None
    due_label: str | None
    countdown: _Countdown | None
    is_overdue: bool
    is_due_today: bool
    is_completed: bool


def _format_due_label(due_at: datetime, time_zone: tzinfo) -> str:
    local_due_at = due_at.astimezone(time_zone)
    return f"{local_due_at:%a} {local_due_at.day} {local_due_at:%b}, {local_due_at:%H:%M}"


def _format_for_due_time_input(due_at: datetime | None, time_zone: tzinfo) -> str:
    return f"{due_at.astimezone(time_zone):%Y-%m-%dT%H:%M}" if due_at else ""


def _is_same_day(first: datetime, second: datetime, time_zone: tzinfo) -> bool:
    return first.astimezone(time_zone).date() == second.astimezone(time_zone).date()


def _create_countdown(count: int, singular_unit: str, is_in_future: bool) -> _Countdown:
    unit = singular_unit if count <= 1 else f"{singular_unit}s"
    return _Countdown(value=str(count) if count else "<1", caption=unit if is_in_future else f"{unit} ago")


def _describe_time_until_due(due_at: datetime, now: datetime, time_zone: tzinfo) -> _Countdown:
    is_in_future = due_at > now
    if _is_same_day(due_at, now, time_zone):
        return _create_countdown(int(abs(due_at - now).total_seconds() // 3600), "hour", is_in_future)

    # Comparing dates rather than durations means that something due just after midnight is "1 day" away.
    days = abs((due_at.astimezone(time_zone).date() - now.astimezone(time_zone).date()).days)
    return _create_countdown(days, "day", is_in_future)


def _create_reminder_view(reminder: Reminder, now: datetime, time_zone: tzinfo) -> _ReminderView:
    is_completed = reminder.completed_at is not None
    due_at = reminder.due_at
    is_overdue = not is_completed and due_at is not None and due_at < now
    return _ReminderView(
        id=reminder.id,
        title=reminder.title,
        notes=reminder.notes,
        due_label=_format_due_label(due_at, time_zone) if due_at else None,
        countdown=_describe_time_until_due(due_at, now, time_zone) if due_at else None,
        is_overdue=is_overdue,
        is_due_today=not is_completed and not is_overdue and due_at is not None and _is_same_day(due_at, now, time_zone),
        is_completed=is_completed,
    )


def _sort_by_due_time(reminders: list[Reminder]) -> list[Reminder]:
    # Reminders without a due time go last. The sort is stable, so they stay in the order they were created.
    return sorted(reminders, key=lambda reminder: (reminder.due_at is None, reminder.due_at or datetime.min.replace(tzinfo=UTC)))


def _render_index_page(
    request: Request,
    has_invalid_reminder: bool = False,
    submitted_title: str = "",
    submitted_notes: str = "",
    submitted_due_at: str = "",
) -> HTMLResponse:
    time_zone = request.app.state.time_zone
    reminders = request.app.state.reminders_client.list_all()
    active_reminders = _sort_by_due_time([reminder for reminder in reminders if not reminder.completed_at])
    completed_reminders = _sort_by_due_time([reminder for reminder in reminders if reminder.completed_at])
    now = request.app.state.get_current_time()
    today = now.astimezone(time_zone)

    return _templates.TemplateResponse(
        request,
        "index.html",
        {
            "today_label": f"{today:%A} {today.day} {today:%B}",
            "active_reminders": [_create_reminder_view(reminder, now, time_zone) for reminder in active_reminders],
            "completed_reminders": [_create_reminder_view(reminder, now, time_zone) for reminder in completed_reminders],
            "has_invalid_reminder": has_invalid_reminder,
            "submitted_title": submitted_title,
            "submitted_notes": submitted_notes,
            "submitted_due_at": submitted_due_at,
        },
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT if has_invalid_reminder else status.HTTP_200_OK,
    )


def _render_edit_page(
    request: Request,
    reminder_id: UUID,
    title: str,
    notes: str,
    due_at: str,
    has_invalid_reminder: bool = False,
) -> HTMLResponse:
    return _templates.TemplateResponse(
        request,
        "edit_reminder.html",
        {
            "reminder_id": reminder_id,
            "title": title,
            "notes": notes,
            "due_at": due_at,
            "has_invalid_reminder": has_invalid_reminder,
        },
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT if has_invalid_reminder else status.HTTP_200_OK,
    )


def _render_unavailable_page(request: Request, _: Exception) -> Response:
    return _templates.TemplateResponse(request, "unavailable.html", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


def _parse_entered_due_time(entered_due_at: str, time_zone: tzinfo) -> datetime | None:
    if not entered_due_at:
        return None
    try:
        return datetime.fromisoformat(entered_due_at).replace(tzinfo=time_zone)
    except ValueError as error:
        # Browsers normally send a valid time, so this is treated like any other rejected reminder.
        raise InvalidReminderError from error


def _redirect_to_index_page() -> RedirectResponse:
    # A 303 makes the browser load the page with a GET, so refreshing can't repeat the action.
    return RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)


def _get_reminders_client(request: Request) -> RemindersClient:
    return request.app.state.reminders_client


def _get_time_zone(request: Request) -> tzinfo:
    return request.app.state.time_zone


_RemindersClientDependency = Annotated[RemindersClient, Depends(_get_reminders_client)]
_TimeZoneDependency = Annotated[tzinfo, Depends(_get_time_zone)]

_router = APIRouter()


@_router.get("/", response_class=HTMLResponse)
def show_reminders(request: Request) -> Response:
    """ Shows every reminder, and a form for adding another. """
    return _render_index_page(request)


@_router.post("/reminders")
def add_reminder(
    request: Request,
    reminders_client: _RemindersClientDependency,
    time_zone: _TimeZoneDependency,
    title: Annotated[str, Form()] = "",
    notes: Annotated[str, Form()] = "",
    due_at: Annotated[str, Form()] = "",
) -> Response:
    """ Adds a reminder, or shows the form again with the entered values if the reminder is invalid. """
    try:
        reminders_client.create(title, notes.strip() or None, _parse_entered_due_time(due_at, time_zone))
    except InvalidReminderError:
        # The user can fix this, so it is shown on the page with what they entered rather than treated as a failure.
        return _render_index_page(
            request,
            has_invalid_reminder=True,
            submitted_title=title,
            submitted_notes=notes,
            submitted_due_at=due_at,
        )
    return _redirect_to_index_page()


@_router.get("/reminders/{reminder_id}/edit", response_class=HTMLResponse)
def show_edit_reminder(
    request: Request,
    reminder_id: UUID,
    reminders_client: _RemindersClientDependency,
    time_zone: _TimeZoneDependency,
) -> Response:
    """ Shows a form for editing a reminder. Returns to the reminders if it no longer exists. """
    reminder = reminders_client.get(reminder_id)
    if reminder is None:
        return _redirect_to_index_page()
    return _render_edit_page(
        request,
        reminder_id,
        title=reminder.title,
        notes=reminder.notes or "",
        due_at=_format_for_due_time_input(reminder.due_at, time_zone),
    )


@_router.post("/reminders/{reminder_id}/edit")
def edit_reminder(
    request: Request,
    reminder_id: UUID,
    reminders_client: _RemindersClientDependency,
    time_zone: _TimeZoneDependency,
    title: Annotated[str, Form()] = "",
    notes: Annotated[str, Form()] = "",
    due_at: Annotated[str, Form()] = "",
) -> Response:
    """ Saves changes to a reminder, or shows the form again with the entered values if they are invalid. """
    try:
        reminders_client.update(reminder_id, title, notes.strip() or None, _parse_entered_due_time(due_at, time_zone))
    except InvalidReminderError:
        # The user can fix this, so it is shown on the page with what they entered rather than treated as a failure.
        return _render_edit_page(request, reminder_id, title, notes, due_at, has_invalid_reminder=True)
    return _redirect_to_index_page()


@_router.post("/reminders/{reminder_id}/toggle")
def toggle_reminder(reminder_id: UUID, reminders_client: _RemindersClientDependency) -> Response:
    """ Ticks a reminder off, or unticks it. """
    reminders_client.toggle_completed(reminder_id)
    return _redirect_to_index_page()


@_router.get("/reminders/{reminder_id}/delete", response_class=HTMLResponse)
def confirm_delete_reminder(request: Request, reminder_id: UUID, reminders_client: _RemindersClientDependency) -> Response:
    """ Asks the user to confirm deleting a reminder. Returns to the reminders if it no longer exists. """
    reminder = reminders_client.get(reminder_id)
    if reminder is None:
        return _redirect_to_index_page()
    return _templates.TemplateResponse(request, "confirm_delete.html", {"reminder": reminder})


@_router.post("/reminders/{reminder_id}/delete")
def delete_reminder(reminder_id: UUID, reminders_client: _RemindersClientDependency) -> Response:
    """ Deletes a reminder. """
    reminders_client.delete(reminder_id)
    return _redirect_to_index_page()
