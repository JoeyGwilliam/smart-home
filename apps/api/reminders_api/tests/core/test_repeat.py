from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from reminders_api.core.repeat import Repeat


@pytest.mark.parametrize(("repeat", "expected_moment"), [
    (Repeat.DAILY, datetime(2026, 11, 13, 9, 0, tzinfo=ZoneInfo("Europe/London"))),
    (Repeat.WEEKLY, datetime(2026, 11, 25, 9, 0, tzinfo=ZoneInfo("Europe/London"))),
    (Repeat.FORTNIGHTLY, datetime(2026, 12, 9, 9, 0, tzinfo=ZoneInfo("Europe/London"))),
    (Repeat.MONTHLY, datetime(2027, 1, 11, 9, 0, tzinfo=ZoneInfo("Europe/London"))),
    (Repeat.YEARLY, datetime(2028, 11, 11, 9, 0, tzinfo=ZoneInfo("Europe/London"))),
])
def test_moves_forward_by_count_repeats_when_advancing(repeat: Repeat, expected_moment: datetime) -> None:
    moment = datetime(2026, 11, 11, 9, 0, tzinfo=ZoneInfo("Europe/London"))

    assert repeat.advance(moment, 2) == expected_moment


def test_keeps_clock_time_when_clocks_change() -> None:
    before_clocks_go_back = datetime(2026, 10, 24, 9, 0, tzinfo=ZoneInfo("Europe/London"))

    after_clocks_go_back = Repeat.DAILY.advance(before_clocks_go_back, 1)

    assert after_clocks_go_back.hour == 9
    assert after_clocks_go_back.utcoffset() != before_clocks_go_back.utcoffset()


def test_moves_to_last_day_of_month_when_month_is_shorter() -> None:
    end_of_january = datetime(2027, 1, 31, 9, 0, tzinfo=ZoneInfo("Europe/London"))

    assert Repeat.MONTHLY.advance(end_of_january, 1) == datetime(2027, 2, 28, 9, 0, tzinfo=ZoneInfo("Europe/London"))


def test_moves_to_28th_february_when_yearly_repeat_leaves_leap_day() -> None:
    leap_day = datetime(2028, 2, 29, 9, 0, tzinfo=ZoneInfo("Europe/London"))

    assert Repeat.YEARLY.advance(leap_day, 1) == datetime(2029, 2, 28, 9, 0, tzinfo=ZoneInfo("Europe/London"))
