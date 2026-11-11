from datetime import date

import pytest

from alexa_api.core.spoken_period import SpokenPeriod, describe_day, resolve_spoken_period


def test_resolves_to_that_day_alone_when_a_day_is_said() -> None:
    period = resolve_spoken_period("2026-11-12")

    assert period == SpokenPeriod(date(2026, 11, 12), date(2026, 11, 12))


def test_resolves_to_monday_until_sunday_when_a_week_is_said() -> None:
    period = resolve_spoken_period("2026-W46")

    assert period == SpokenPeriod(date(2026, 11, 9), date(2026, 11, 15))


def test_resolves_to_saturday_and_sunday_when_a_weekend_is_said() -> None:
    period = resolve_spoken_period("2026-W46-WE")

    assert period == SpokenPeriod(date(2026, 11, 14), date(2026, 11, 15))


@pytest.mark.parametrize("unresolvable_date", ["2026-11", "2026", "202X", "20261113", "2026-W46-3", "2026-W60", "2026-WI", "XXXX-W46", "2026-13-40"])
def test_resolves_to_none_when_date_is_not_a_day_week_or_weekend(unresolvable_date: str) -> None:
    period = resolve_spoken_period(unresolvable_date)

    assert period is None


@pytest.mark.parametrize(
    ("day", "expected_answer"),
    [(date(2026, 11, 8), False), (date(2026, 11, 9), True), (date(2026, 11, 12), True), (date(2026, 11, 15), True), (date(2026, 11, 16), False)],
)
def test_includes_only_first_and_last_day_and_those_between_when_checking_a_day(day: date, expected_answer: bool) -> None:
    week = SpokenPeriod(date(2026, 11, 9), date(2026, 11, 15))

    is_included = week.includes(day)

    assert is_included == expected_answer


@pytest.mark.parametrize(
    ("period", "expected_description"),
    [
        (SpokenPeriod(date(2026, 11, 11), date(2026, 11, 11)), "today"),
        (SpokenPeriod(date(2026, 11, 12), date(2026, 11, 12)), "tomorrow"),
        (SpokenPeriod(date(2026, 11, 13), date(2026, 11, 13)), "on Friday"),
        (SpokenPeriod(date(2026, 11, 9), date(2026, 11, 15)), "this week"),
        (SpokenPeriod(date(2026, 11, 16), date(2026, 11, 22)), "next week"),
        (SpokenPeriod(date(2026, 11, 23), date(2026, 11, 29)), "in the week of Monday 23 November"),
        (SpokenPeriod(date(2026, 11, 14), date(2026, 11, 15)), "this weekend"),
        (SpokenPeriod(date(2026, 11, 21), date(2026, 11, 22)), "next weekend"),
        (SpokenPeriod(date(2026, 11, 28), date(2026, 11, 29)), "on the weekend of Saturday 28 November"),
    ],
)
def test_describes_period_relative_to_today_when_describing(period: SpokenPeriod, expected_description: str) -> None:
    wednesday = date(2026, 11, 11)

    description = period.describe(wednesday)

    assert description == expected_description


@pytest.mark.parametrize(
    ("day", "expected_description"),
    [
        (date(2026, 11, 11), "today"),
        (date(2026, 11, 12), "tomorrow"),
        (date(2026, 11, 10), "yesterday"),
        (date(2026, 11, 13), "on Friday"),
        (date(2026, 11, 18), "on Wednesday 18 November"),
        (date(2026, 11, 2), "on Monday 2 November"),
    ],
)
def test_describes_day_relative_to_today_when_describing_a_day(day: date, expected_description: str) -> None:
    wednesday = date(2026, 11, 11)

    description = describe_day(day, wednesday)

    assert description == expected_description
