from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from alexa_api.core.spoken_period import describe_day, resolve_spoken_period

# Alexa turns "in the morning" and similar into these codes rather than a time of day.
_TIMES_BY_PART_OF_DAY = {"MO": time(9), "AF": time(13), "EV": time(18), "NI": time(21)}


@dataclass(frozen=True)
class DueTime:
    """ When a reminder is due: either at a particular moment, or at any time on a day.

    Attributes:
        at:
            Timezone-aware moment that the reminder is due. For an all-day reminder, the start of the day it is due, in
            the time zone that the person means their days in.
        is_all_day:
            Whether the reminder is due at any time on the day of `at`, rather than at a particular time.
    """

    at: datetime
    is_all_day: bool


def resolve_due_time(spoken_date: str | None, spoken_time: str | None, now: datetime) -> DueTime | None:
    """ Works out when a person meant when they said a day, a time, or both.

    A day by itself means all of that day. A time by itself means the next time the clock shows it.

    Args:
        spoken_date:
            What Alexa heard as the day, in its AMAZON.DATE format, or None if no day was said. Only a single day,
            such as `2026-11-12`, can be resolved; a week, month or year can't.
        spoken_time:
            What Alexa heard as the time, in its AMAZON.TIME format, or None if no time was said. Either a time of
            day, such as `17:30`, or a part of the day, such as `EV` for the evening.
        now:
            The current moment, in the time zone that the person means their days and times in.

    Returns:
        When the reminder is due, in the time zone of `now`. None if neither was said, or if either couldn't be
        resolved.
    """
    due_date = None if spoken_date is None else _parse_date(spoken_date)
    due_time = None if spoken_time is None else _parse_time(spoken_time)
    is_anything_unresolved = (spoken_date is not None and due_date is None) or (spoken_time is not None and due_time is None)
    if is_anything_unresolved or (due_date is None and due_time is None):
        return None

    if due_time is None:
        return DueTime(datetime.combine(due_date, time(0), tzinfo=now.tzinfo), is_all_day=True)

    if due_date is None:
        is_time_still_to_come_today = due_time > now.time()
        due_date = now.date() if is_time_still_to_come_today else now.date() + timedelta(days=1)

    return DueTime(datetime.combine(due_date, due_time, tzinfo=now.tzinfo), is_all_day=False)


def describe_due_time(due_time: DueTime, now: datetime) -> str:
    """ Describes when a reminder is due the way a person would say it, relative to now.

    Args:
        due_time:
            When the reminder is due. Must be in the same time zone as `now`.
        now:
            The current moment.

    Returns:
        A phrase that completes "it is due ...", such as "today at 5 PM", "on Friday at 9:30 AM" or
        "on Friday 20 November at 9 AM". For an all-day reminder, only the day, such as "on Friday".
    """
    day = describe_day(due_time.at.date(), now.date())
    return day if due_time.is_all_day else f"{day} at {describe_time_of_day(due_time.at)}"


def describe_time_of_day(moment: datetime) -> str:
    """ Describes the time of day of a moment the way a person would say it.

    Args:
        moment:
            The moment whose time of day to describe.

    Returns:
        The time on a 12-hour clock, such as "5 PM" or "9:30 AM".
    """
    hour = moment.hour % 12 or 12
    minutes = "" if moment.minute == 0 else f":{moment.minute:02}"
    return f"{hour}{minutes} {'AM' if moment.hour < 12 else 'PM'}"


def _parse_date(spoken_date: str) -> date | None:
    period = resolve_spoken_period(spoken_date)
    # A week or a weekend doesn't say which of its days the reminder is due.
    return period.first_day if period is not None and period.first_day == period.last_day else None


def _parse_time(spoken_time: str) -> time | None:
    if spoken_time in _TIMES_BY_PART_OF_DAY:
        return _TIMES_BY_PART_OF_DAY[spoken_time]
    try:
        return datetime.strptime(spoken_time, "%H:%M").time()
    except ValueError:
        # AMAZON.TIME can also give durations and seconds, which don't make sense as a due time. The caller asks the
        # person to say it again.
        return None
