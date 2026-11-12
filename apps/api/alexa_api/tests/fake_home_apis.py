import json
from typing import Any

import httpx


def create_fake_reminders_api(reminders: list[dict[str, Any]]) -> httpx.MockTransport:
    """ Creates a stand-in for the reminders API, for a `RemindersClient` to use as its transport.

    Args:
        reminders:
            The reminders that the API holds, in its JSON form, each with an `id`. The API's changes are made to
            this list: created reminders are appended with the id `new-reminder`, no notes, not all day, no
            completion time, no repeat.

    Returns:
        The transport.
    """
    def handle_request(request: httpx.Request) -> httpx.Response:
        reminder_id = request.url.path.removeprefix("/reminders").removeprefix("/")
        position = next((index for index, reminder in enumerate(reminders) if reminder["id"] == reminder_id), None)
        if request.method == "POST" and not reminder_id:
            reminders.append({"id": "new-reminder", "notes": None, "is_all_day": False, "completed_at": None, "repeats": None, "assigned_to": None} | json.loads(request.content))
            return httpx.Response(201, json=reminders[-1])
        if request.method == "GET" and not reminder_id:
            return httpx.Response(200, json=reminders)
        if request.method == "PUT" and position is not None:
            reminders[position] = {"id": reminder_id} | json.loads(request.content)
            return httpx.Response(200, json=reminders[position])
        if request.method == "DELETE":
            if position is not None:
                del reminders[position]
            return httpx.Response(204)
        return httpx.Response(404)

    return httpx.MockTransport(handle_request)


def create_fake_timers_api(presets: list[dict[str, Any]], active_timer: dict[str, Any]) -> httpx.MockTransport:
    """ Creates a stand-in for the timers API, for a `TimersClient` to use as its transport.

    Args:
        presets:
            The presets that the API holds, in its JSON form.
        active_timer:
            The timer that every screen shows, in the API's JSON form. Saving the timer replaces this dict's
            contents.

    Returns:
        The transport.
    """
    def handle_request(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/presets":
            return httpx.Response(200, json=presets)
        if request.method == "GET" and request.url.path == "/active-timer":
            return httpx.Response(200, json=active_timer)
        if request.method == "PUT" and request.url.path == "/active-timer":
            active_timer.clear()
            active_timer.update(json.loads(request.content))
            return httpx.Response(200, json=active_timer)
        return httpx.Response(404)

    return httpx.MockTransport(handle_request)


def create_fake_site_editor_api(messages: list[str], state: str = "idle", is_busy: bool = False) -> httpx.MockTransport:
    """ Creates a stand-in for the site editor API, for a `SiteEditorClient` to use as its transport.

    Args:
        messages:
            The text of every message that the API accepts is appended to this list.
        state:
            Where the API says the change has got to.
        is_busy:
            Whether the API refuses messages because it is in the middle of something.

    Returns:
        The transport.
    """
    def handle_request(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/change/messages":
            if is_busy:
                return httpx.Response(409, json={"detail": "Claude is still working."})
            messages.append(json.loads(request.content)["text"])
            return httpx.Response(202)
        if request.method == "GET" and request.url.path == "/change":
            return httpx.Response(200, json={"state": state, "events": [], "changed_files": []})
        return httpx.Response(404)

    return httpx.MockTransport(handle_request)


def create_failing_api(status_code: int | None = None) -> httpx.MockTransport:
    """ Creates a stand-in for any of the home's APIs when it is not working.

    Args:
        status_code:
            The status that every request gets. None to refuse the connection instead.

    Returns:
        The transport.
    """
    def handle_request(request: httpx.Request) -> httpx.Response:
        if status_code is None:
            raise httpx.ConnectError("Connection refused", request=request)
        return httpx.Response(status_code)

    return httpx.MockTransport(handle_request)
