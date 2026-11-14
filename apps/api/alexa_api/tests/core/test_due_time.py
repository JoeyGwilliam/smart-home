from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from alexa_api.core.due_time import DueTime, describe_due_time, describe_time_of_day, resolve_due_time

_LONDON = ZoneInfo("Europe/London")


def test_resolves_to_that_day_and_time_when_both_are_said() -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_time = resolve_due_time("2026-11-13", "17:30", wednesday_noon)

    assert due_time == DueTime(datetime(2026, 11, 13, 17, 30, tzinfo=_LONDON), is_all_day=False)


def test_resolves_to_all_of_that_day_when_only_day_is_said() -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_time = resolve_due_time("2026-11-13", None, wednesday_noon)

    assert due_time == DueTime(datetime(2026, 11, 13, 0, 0, tzinfo=_LONDON), is_all_day=True)


def test_resolves_to_today_when_only_a_time_still_to_come_is_said() -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_time = resolve_due_time(None, "17:00", wednesday_noon)

    assert due_time == DueTime(datetime(2026, 11, 11, 17, 0, tzinfo=_LONDON), is_all_day=False)


def test_resolves_to_tomorrow_when_only_a_time_already_past_is_said() -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_time = resolve_due_time(None, "08:00", wednesday_noon)

    assert due_time == DueTime(datetime(2026, 11, 12, 8, 0, tzinfo=_LONDON), is_all_day=False)


@pytest.mark.parametrize(
    ("part_of_day", "expected_hour"),
    [("MO", 9), ("AF", 13), ("EV", 18), ("NI", 21)],
)
def test_resolves_to_a_fixed_hour_when_part_of_day_is_said(part_of_day: str, expected_hour: int) -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_time = resolve_due_time("2026-11-13", part_of_day, wednesday_noon)

    assert due_time == DueTime(datetime(2026, 11, 13, expected_hour, 0, tzinfo=_LONDON), is_all_day=False)


def test_keeps_the_said_clock_time_when_summer_time_is_in_force() -> None:
    summer_noon = datetime(2026, 6, 10, 12, 0, tzinfo=_LONDON)

    due_time = resolve_due_time("2026-06-11", "17:00", summer_noon)

    assert due_time.at.isoformat() == "2026-06-11T17:00:00+01:00"


def test_starts_the_day_at_home_midnight_when_only_day_is_said_in_summer_time() -> None:
    summer_noon = datetime(2026, 6, 10, 12, 0, tzinfo=_LONDON)

    due_time = resolve_due_time("2026-06-11", None, summer_noon)

    assert due_time.at.isoformat() == "2026-06-11T00:00:00+01:00"


def test_resolves_to_none_when_nothing_is_said() -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_at = resolve_due_time(None, None, wednesday_noon)

    assert due_at is None


@pytest.mark.parametrize("date_that_is_not_one_day", ["2026-W46", "2026-W46-WE", "2026-11", "2026", "202X", "20261113"])
def test_resolves_to_none_when_date_is_not_a_single_day(date_that_is_not_one_day: str) -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_at = resolve_due_time(date_that_is_not_one_day, "17:00", wednesday_noon)

    assert due_at is None


@pytest.mark.parametrize("time_that_is_not_a_time_of_day", ["PT5M", "17:00:30", "soon"])
def test_resolves_to_none_when_time_is_not_a_time_of_day(time_that_is_not_a_time_of_day: str) -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    due_at = resolve_due_time("2026-11-13", time_that_is_not_a_time_of_day, wednesday_noon)

    assert due_at is None


@pytest.mark.parametrize(
    ("due_at", "expected_description"),
    [
        (datetime(2026, 11, 11, 17, 0, tzinfo=_LONDON), "today at 5 PM"),
        (datetime(2026, 11, 12, 9, 30, tzinfo=_LONDON), "tomorrow at 9:30 AM"),
        (datetime(2026, 11, 10, 9, 0, tzinfo=_LONDON), "yesterday at 9 AM"),
        (datetime(2026, 11, 13, 17, 0, tzinfo=_LONDON), "on Friday at 5 PM"),
        (datetime(2026, 11, 18, 17, 0, tzinfo=_LONDON), "on Wednesday 18 November at 5 PM"),
        (datetime(2026, 11, 2, 17, 0, tzinfo=_LONDON), "on Monday 2 November at 5 PM"),
    ],
)
def test_describes_day_relative_to_now_when_describing_due_time(due_at: datetime, expected_description: str) -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    description = describe_due_time(DueTime(due_at, is_all_day=False), wednesday_noon)

    assert description == expected_description


@pytest.mark.parametrize(
    ("due_on", "expected_description"),
    [
        (datetime(2026, 11, 11, 0, 0, tzinfo=_LONDON), "today"),
        (datetime(2026, 11, 13, 0, 0, tzinfo=_LONDON), "on Friday"),
        (datetime(2026, 11, 18, 0, 0, tzinfo=_LONDON), "on Wednesday 18 November"),
    ],
)
def test_describes_only_the_day_when_describing_all_day_due_time(due_on: datetime, expected_description: str) -> None:
    wednesday_noon = datetime(2026, 11, 11, 12, 0, tzinfo=_LONDON)

    description = describe_due_time(DueTime(due_on, is_all_day=True), wednesday_noon)

    assert description == expected_description


@pytest.mark.parametrize(
    ("hour", "minute", "expected_description"),
    [(0, 0, "12 AM"), (0, 5, "12:05 AM"), (9, 0, "9 AM"), (12, 0, "12 PM"), (17, 45, "5:45 PM"), (23, 59, "11:59 PM")],
)
def test_describes_time_on_twelve_hour_clock_when_describing_time_of_day(
        hour: int,
        minute: int,
        expected_description: str,
) -> None:
    moment = datetime(2026, 11, 11, hour, minute, tzinfo=_LONDON)

    description = describe_time_of_day(moment)

    assert description == expected_description
