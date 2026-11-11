import re
from dataclasses import dataclass
from datetime import date, timedelta

_MONTH_NAMES = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
                "November", "December")
_WEEKDAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

# How AMAZON.DATE gives a day, such as "2026-11-12", and a week or its weekend, such as "2026-W46" or "2026-W46-WE".
_DAY_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
_WEEK_PATTERN = re.compile(r"(?P<year>\d{4})-W(?P<week>\d{2})(?P<weekend>-WE)?")


@dataclass(frozen=True)
class SpokenPeriod:
    """ A run of whole days that a person named aloud, such as tomorrow, this weekend or next week.

    Attributes:
        first_day:
            The first day of the period.
        last_day:
            The last day of the period, which is the same as `first_day` for a single day. Never before `first_day`.
    """

    first_day: date
    last_day: date

    def includes(self, day: date) -> bool:
        """ Says whether a day is one of the period's days.

        Args:
            day:
                The day to look for.

        Returns:
            True if the day is the first day, the last day or any day between them.
        """
        return self.first_day <= day <= self.last_day

    def describe(self, today: date) -> str:
        """ Describes the period the way a person would say it, relative to today.

        Args:
            today:
                The current day, in the time zone that the person means their days in.

        Returns:
            A phrase that completes "nothing is due ...", such as "today", "on Friday", "this weekend" or
            "in the week of Monday 23 November".
        """
        if self.first_day == self.last_day:
            return describe_day(self.first_day, today)

        weeks_away = (_find_monday(self.first_day) - _find_monday(today)).days // 7
        is_weekend = self.first_day.weekday() == 5
        if weeks_away == 0:
            return "this weekend" if is_weekend else "this week"
        if weeks_away == 1:
            return "next weekend" if is_weekend else "next week"
        if is_weekend:
            return f"on the weekend of {_name_date(self.first_day)}"
        return f"in the week of {_name_date(self.first_day)}"


def resolve_spoken_period(spoken_date: str) -> SpokenPeriod | None:
    """ Works out the days that a person meant when they said a day, a week or a weekend.

    Args:
        spoken_date:
            What Alexa heard, in its AMAZON.DATE format: a day such as `2026-11-12`, a week such as `2026-W46`, or
            the weekend of a week such as `2026-W46-WE`.

    Returns:
        The period. None for anything else that AMAZON.DATE can give, such as a month, a year or a season.
    """
    try:
        if _DAY_PATTERN.fullmatch(spoken_date):
            day = date.fromisoformat(spoken_date)
            return SpokenPeriod(day, day)

        week = _WEEK_PATTERN.fullmatch(spoken_date)
        if week is None:
            return None
        monday = date.fromisocalendar(int(week["year"]), int(week["week"]), 1)
    except ValueError:
        # Shaped like a day or a week, but not a real one, such as 2026-13-40 or week 60. The caller tells the person
        # what it can understand.
        return None

    if week["weekend"]:
        return SpokenPeriod(monday + timedelta(days=5), monday + timedelta(days=6))
    return SpokenPeriod(monday, monday + timedelta(days=6))


def describe_day(day: date, today: date) -> str:
    """ Describes a day the way a person would say it, relative to today.

    Args:
        day:
            The day to describe.
        today:
            The current day.

    Returns:
        A phrase that completes "it is due ...", such as "today", "tomorrow", "on Friday" or "on Friday 20 November".
    """
    days_away = (day - today).days
    if days_away == 0:
        return "today"
    if days_away == 1:
        return "tomorrow"
    if days_away == -1:
        return "yesterday"
    if 1 < days_away < 7:
        return f"on {_WEEKDAY_NAMES[day.weekday()]}"
    return f"on {_name_date(day)}"


def _name_date(day: date) -> str:
    return f"{_WEEKDAY_NAMES[day.weekday()]} {day.day} {_MONTH_NAMES[day.month - 1]}"


def _find_monday(day: date) -> date:
    return day - timedelta(days=day.weekday())
