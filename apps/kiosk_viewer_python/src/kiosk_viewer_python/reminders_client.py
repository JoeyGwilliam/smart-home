from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx


@dataclass(frozen=True)
class Reminder:
    """ A reminder held by the reminders API.

    Attributes:
        id:
            Unique identifier of the reminder.
        title:
            Short description of the reminder.
        notes:
            Optional longer details.
        due_at:
            Timezone-aware due time, or None if there is no due time.
        completed_at:
            Timezone-aware completion time, or None if not completed.
    """
    id: UUID
    title: str
    notes: str | None
    due_at: datetime | None
    completed_at: datetime | None


class RemindersUnavailableError(Exception):
    """ The reminders API could not be reached, or failed to handle a request. """


class InvalidReminderError(Exception):
    """ The reminders API rejected a reminder's content. """


class RemindersClient:
    """ Reads and changes reminders held by the reminders API. """

    def __init__(self, http_client: httpx.Client) -> None:
        """ Creates a client.

        Args:
            http_client:
                HTTP client whose base URL is the reminders API.
        """
        self._http_client = http_client

    def list_all(self) -> list[Reminder]:
        """ Lists every reminder.

        Returns:
            All reminders, oldest first.

        Raises:
            RemindersUnavailableError: If the reminders API is unavailable.
        """
        response = self._send("GET", "/reminders")
        response.raise_for_status()
        return [_parse_reminder(reminder_json) for reminder_json in response.json()]

    def get(self, reminder_id: UUID) -> Reminder | None:
        """ Finds a single reminder.

        Args:
            reminder_id:
                Identifier of the reminder to find.

        Returns:
            The matching reminder, or None if there isn't one.

        Raises:
            RemindersUnavailableError: If the reminders API is unavailable.
        """
        response = self._send("GET", f"/reminders/{reminder_id}")
        if response.status_code == httpx.codes.NOT_FOUND:
            return None
        response.raise_for_status()
        return _parse_reminder(response.json())

    def create(self, title: str, notes: str | None, due_at: datetime | None) -> None:
        """ Creates a reminder that isn't completed.

        Args:
            title:
                Short description of the reminder.
            notes:
                Optional longer details.
            due_at:
                Timezone-aware due time, or None if there is no due time.

        Raises:
            InvalidReminderError: If the reminders API rejects the reminder's content.
            RemindersUnavailableError: If the reminders API is unavailable.
        """
        reminder_json = {"title": title, "notes": notes, "due_at": _format_time(due_at), "completed_at": None}
        _check_reminder_was_accepted(self._send("POST", "/reminders", json=reminder_json))

    def update(self, reminder_id: UUID, title: str, notes: str | None, due_at: datetime | None) -> None:
        """ Changes a reminder's content, keeping whether it is completed. Does nothing if it doesn't exist.

        Args:
            reminder_id:
                Identifier of the reminder to change.
            title:
                New short description of the reminder.
            notes:
                New optional longer details.
            due_at:
                New timezone-aware due time, or None if there is no due time.

        Raises:
            InvalidReminderError: If the reminders API rejects the reminder's new content.
            RemindersUnavailableError: If the reminders API is unavailable.
        """
        reminder = self.get(reminder_id)
        if reminder is None:
            return

        reminder_json = {
            "title": title,
            "notes": notes,
            "due_at": _format_time(due_at),
            "completed_at": _format_time(reminder.completed_at),
        }
        _check_reminder_was_accepted(self._send("PUT", f"/reminders/{reminder_id}", json=reminder_json))

    def toggle_completed(self, reminder_id: UUID) -> None:
        """ Marks a reminder as completed now, or as not completed if it already is. Does nothing if it doesn't exist.

        Args:
            reminder_id:
                Identifier of the reminder to change.

        Raises:
            RemindersUnavailableError: If the reminders API is unavailable.
        """
        reminder = self.get(reminder_id)
        if reminder is None:
            return

        completed_at = None if reminder.completed_at else datetime.now(UTC)
        reminder_json = {
            "title": reminder.title,
            "notes": reminder.notes,
            "due_at": _format_time(reminder.due_at),
            "completed_at": _format_time(completed_at),
        }
        self._send("PUT", f"/reminders/{reminder_id}", json=reminder_json).raise_for_status()

    def delete(self, reminder_id: UUID) -> None:
        """ Ensures that a reminder no longer exists. Does nothing if it doesn't exist.

        Args:
            reminder_id:
                Identifier of the reminder to delete.

        Raises:
            RemindersUnavailableError: If the reminders API is unavailable.
        """
        self._send("DELETE", f"/reminders/{reminder_id}").raise_for_status()

    def _send(self, method: str, path: str, **request_options: Any) -> httpx.Response:
        try:
            response = self._http_client.request(method, path, **request_options)
        except httpx.TransportError as error:
            # Callers can't recover from this, so every failure to communicate becomes the one error they document.
            raise RemindersUnavailableError from error

        if response.is_server_error:
            raise RemindersUnavailableError
        return response


def _check_reminder_was_accepted(response: httpx.Response) -> None:
    if response.status_code == httpx.codes.UNPROCESSABLE_ENTITY:
        raise InvalidReminderError
    response.raise_for_status()


def _format_time(moment: datetime | None) -> str | None:
    return moment.isoformat() if moment else None


def _parse_time(text: str | None) -> datetime | None:
    return datetime.fromisoformat(text) if text else None


def _parse_reminder(reminder_json: dict[str, Any]) -> Reminder:
    return Reminder(
        id=UUID(reminder_json["id"]),
        title=reminder_json["title"],
        notes=reminder_json["notes"],
        due_at=_parse_time(reminder_json["due_at"]),
        completed_at=_parse_time(reminder_json["completed_at"]),
    )
