from datetime import datetime

import httpx

from alexa_api.core.reminder import Reminder

# Alexa gives up on a skill after 8 seconds, so a slow reminders API has to fail soon enough to still say so.
_TIMEOUT_SECONDS = 4


class RemindersUnavailableError(Exception):
    """ The reminders API couldn't be reached, or didn't do what was asked. """


class RemindersClient:
    """ The reminders that the home's site shows, reached through the reminders API.

    Going through the API, rather than its database, keeps the API as the one owner of what a valid reminder is.
    """

    def __init__(self, reminders_api_url: str, transport: httpx.BaseTransport | None = None) -> None:
        """ Creates a client for one reminders API.

        Args:
            reminders_api_url:
                Address of the reminders API, such as `http://reminders-api:8000`.
            transport:
                How requests are sent. Only tests need to set this, to stand in for the API.
        """
        self._http_client = httpx.Client(base_url=reminders_api_url, timeout=_TIMEOUT_SECONDS, transport=transport)

    def add_reminder(self, title: str, due_at: datetime | None) -> None:
        """ Adds a reminder, which the site then shows.

        Args:
            title:
                Short description of the reminder. Must contain non-whitespace text.
            due_at:
                Timezone-aware due time, or None if there is no due time.

        Raises:
            RemindersUnavailableError: If the reminders API couldn't be reached, or rejected the reminder.
        """
        due_at_text = None if due_at is None else due_at.isoformat()
        self._send("POST", "/reminders", json={"title": title, "due_at": due_at_text})

    def list_unfinished_reminders(self) -> list[Reminder]:
        """ Lists every reminder that hasn't been completed.

        Returns:
            The reminders, oldest first.

        Raises:
            RemindersUnavailableError: If the reminders API couldn't be reached.
        """
        response = self._send("GET", "/reminders")
        return [
            Reminder(
                title=reminder["title"],
                due_at=None if reminder["due_at"] is None else datetime.fromisoformat(reminder["due_at"]),
            )
            for reminder in response.json()
            if reminder["completed_at"] is None
        ]

    def _send(self, method: str, path: str, **request_options: object) -> httpx.Response:
        try:
            response = self._http_client.request(method, path, **request_options)
            return response.raise_for_status()
        except httpx.HTTPError as error:
            # Every way that the API can fail leaves the person in the same position: what they asked for didn't
            # happen. One error lets the skill tell them so in one place.
            raise RemindersUnavailableError(f"The reminders API failed to handle {method} {path}.") from error
