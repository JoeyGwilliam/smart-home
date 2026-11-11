from datetime import UTC, datetime, time

import pytest

from timers_api.core.active_timer import ActiveTimer
from timers_api.core.timer_plan import TimerPlan


def test_raises_value_error_when_started_at_has_no_time_zone() -> None:
    started_at_without_time_zone = datetime(2026, 11, 11, 16, 0)

    with pytest.raises(ValueError, match="started_at"):
        ActiveTimer(plan=TimerPlan(name="School run", end_time=time(17, 0)), started_at=started_at_without_time_zone)


def test_accepts_active_timer_when_started_at_has_time_zone() -> None:
    started_at = datetime(2026, 11, 11, 16, 0, tzinfo=UTC)

    active_timer = ActiveTimer(plan=TimerPlan(name="School run", end_time=time(17, 0)), started_at=started_at)

    assert active_timer.started_at == started_at


def test_is_stopped_when_only_plan_is_given() -> None:
    active_timer = ActiveTimer(plan=TimerPlan(name="School run", end_time=time(17, 0)))

    assert active_timer.started_at is None
