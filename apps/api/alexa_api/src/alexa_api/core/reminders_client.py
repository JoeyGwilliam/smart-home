from datetime import datetime

import httpx

from alexa_api.core.due_time import DueTime
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

    def add_reminder(self, title: str, due_time: DueTime | None, assigned_to: str | None = None) -> None:
        """ Adds a reminder, which the site then shows.

        Args:
            title:
                Short description of the reminder. Must contain non-whitespace text.
            due_time:
                When the reminder is due, or None if there is no due time.
            assigned_to:
                The name of the person the reminder is for, which the reminders API must know, or None if it is for
                nobody in particular.
        """
        self._api.send("POST", "/reminders", json={"title": title, **_represent_due_time(due_time), "assigned_to": assigned_to})

    def list_unfinished_reminders(self) -> list[Reminder]:
        """ Lists every reminder that hasn't been completed.

        Returns:
            The reminders, oldest first.
        """
        return [
            Reminder(
                id=reminder["id"],
                title=reminder["title"],
                due_at=None if reminder["due_at"] is None else datetime.fromisoformat(reminder["due_at"]),
                is_all_day=reminder["is_all_day"],
            )
            for reminder in self._api.send("GET", "/reminders").json()
            if reminder["completed_at"] is None
        ]

    def complete_reminder(self, reminder: Reminder, completed_at: datetime) -> None:
        """ Ticks a reminder off. If it repeats, the reminders API adds the next one.

        Args:
            reminder:
                The reminder to tick off.
            completed_at:
                Timezone-aware moment that it was done.
        """
        self._api.send("PATCH", f"/reminders/{reminder.id}", json={"completed_at": _represent_moment(completed_at)})

    def move_reminder(self, reminder: Reminder, due_time: DueTime | None) -> None:
        """ Changes when a reminder is due, including whether it is all day. Everything else about it stays as it is.

        Args:
            reminder:
                The reminder to move.
            due_time:
                When it is now due, or None to leave it with no due time.
        """
        self._api.send("PATCH", f"/reminders/{reminder.id}", json=_represent_due_time(due_time))

    def delete_reminder(self, reminder: Reminder) -> None:
        """ Deletes a reminder for good. Does nothing if it has already been deleted.

        Args:
            reminder:
                The reminder to delete.
        """
        self._api.send("DELETE", f"/reminders/{reminder.id}")


def _represent_due_time(due_time: DueTime | None) -> dict[str, str | bool | None]:
    # Only a reminder with a due time can be all day, so a reminder with none is never all day.
    if due_time is None:
        return {"due_at": None, "is_all_day": False}
    return {"due_at": _represent_moment(due_time.at), "is_all_day": due_time.is_all_day}


def _represent_moment(moment: datetime | None) -> str | None:
    return None if moment is None else moment.isoformat()
