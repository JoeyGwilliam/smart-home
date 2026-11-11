from datetime import datetime

import httpx

from alexa_api.core.home_api import HomeApi
from alexa_api.core.reminder import Reminder


class RemindersClient:
    """ The reminders that the home's site shows, reached through the reminders API.

    Going through the API, rather than its database, keeps the API as the one owner of what a valid reminder is.
    Every method raises `HomeApiUnavailableError` if the API couldn't be reached or refused what was asked.
    """

    def __init__(self, reminders_api_url: str, transport: httpx.BaseTransport | None = None) -> None:
        """ Creates a client for one reminders API.

        Args:
            reminders_api_url:
                Address of the reminders API, such as `http://reminders-api:8000`.
            transport:
                How requests are sent. Only tests need to set this, to stand in for the API.
        """
        self._api = HomeApi("reminders", reminders_api_url, transport)

    def add_reminder(self, title: str, due_at: datetime | None, assigned_to: str | None = None) -> None:
        """ Adds a reminder, which the site then shows.

        Args:
            title:
                Short description of the reminder. Must contain non-whitespace text.
            due_at:
                Timezone-aware due time, or None if there is no due time.
            assigned_to:
                The name of the person the reminder is for, which the reminders API must know, or None if it is for
                nobody in particular.
        """
        self._api.send("POST", "/reminders", json={
            "title": title,
            "due_at": _represent_moment(due_at),
            "assigned_to": assigned_to,
        })

    def list_unfinished_reminders(self) -> list[Reminder]:
        """ Lists every reminder that hasn't been completed.

        Returns:
            The reminders, oldest first.
        """
        return [
            Reminder(
                id=reminder["id"],
                title=reminder["title"],
                notes=reminder["notes"],
                due_at=None if reminder["due_at"] is None else datetime.fromisoformat(reminder["due_at"]),
                repeats=reminder["repeats"],
                assigned_to=reminder["assigned_to"],
            )
            for reminder in self._api.send("GET", "/reminders").json()
            if reminder["completed_at"] is None
        ]

    def save_reminder(self, reminder: Reminder) -> None:
        """ Replaces the reminder that has the same id with this one.

        Args:
            reminder:
                The reminder as it should now be.
        """
        self._api.send("PUT", f"/reminders/{reminder.id}", json={
            "title": reminder.title,
            "notes": reminder.notes,
            "due_at": _represent_moment(reminder.due_at),
            "completed_at": _represent_moment(reminder.completed_at),
            "repeats": reminder.repeats,
            "assigned_to": reminder.assigned_to,
        })

    def delete_reminder(self, reminder: Reminder) -> None:
        """ Deletes a reminder for good. Does nothing if it has already been deleted.

        Args:
            reminder:
                The reminder to delete.
        """
        self._api.send("DELETE", f"/reminders/{reminder.id}")


def _represent_moment(moment: datetime | None) -> str | None:
    return None if moment is None else moment.isoformat()
