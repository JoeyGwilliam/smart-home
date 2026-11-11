import json
from typing import Any

import httpx


def create_fake_reminders_api(reminders: list[dict[str, Any]]) -> httpx.MockTransport:
    """ Creates a stand-in for the reminders API, for a `RemindersClient` to use as its transport.

    Args:
        reminders:
            The reminders that the API holds, in its JSON form. Reminders that are created through the API are
            appended to this list, with no completion time.

    Returns:
        The transport.
    """
    def handle_request(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/reminders":
            reminder = json.loads(request.content) | {"completed_at": None}
            reminders.append(reminder)
            return httpx.Response(201, json=reminder)
        if request.method == "GET" and request.url.path == "/reminders":
            return httpx.Response(200, json=reminders)
        return httpx.Response(404)

    return httpx.MockTransport(handle_request)


def create_failing_reminders_api(status_code: int | None = None) -> httpx.MockTransport:
    """ Creates a stand-in for a reminders API that is not working.

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
