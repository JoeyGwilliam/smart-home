from datetime import UTC, datetime
from typing import Any

import pytest

from alexa_api.core.home_api import HomeApiUnavailableError
from alexa_api.core.timer_preset import TimerPreset
from alexa_api.core.timers_client import TimersClient
from tests.fake_home_apis import create_failing_api, create_fake_timers_api


def test_lists_presets_by_plan_name_when_listing_presets() -> None:
    school_run_plan = {"name": "School run", "end_time": "08:30:00", "tasks": [], "faff_multiplier": 1.5}
    bedtime_plan = {"name": "Bedtime", "end_time": "20:00:00", "tasks": [], "faff_multiplier": 1.0}
    held_presets = [{"id": "school-run", "plan": school_run_plan}, {"id": "bedtime", "plan": bedtime_plan}]
    client = TimersClient("http://timers-api", create_fake_timers_api(held_presets, active_timer={}))

    presets = client.list_presets()

    assert presets == [TimerPreset("School run", school_run_plan), TimerPreset("Bedtime", bedtime_plan)]


def test_replaces_plan_and_sets_start_when_starting_timer_from_preset() -> None:
    school_run_plan = {"name": "School run", "end_time": "08:30:00", "tasks": [], "faff_multiplier": 1.5}
    active_timer: dict[str, Any] = {"plan": {"name": "Bedtime", "end_time": "20:00:00"}, "started_at": None}
    client = TimersClient("http://timers-api", create_fake_timers_api([], active_timer))

    client.start_timer(datetime(2026, 11, 11, 7, 45, tzinfo=UTC), TimerPreset("School run", school_run_plan))

    assert active_timer == {"plan": school_run_plan, "started_at": "2026-11-11T07:45:00+00:00"}


def test_keeps_plan_and_sets_start_when_starting_timer_without_preset() -> None:
    bedtime_plan = {"name": "Bedtime", "end_time": "20:00:00", "tasks": [], "faff_multiplier": 1.0}
    active_timer: dict[str, Any] = {"plan": bedtime_plan, "started_at": None}
    client = TimersClient("http://timers-api", create_fake_timers_api([], active_timer))

    client.start_timer(datetime(2026, 11, 11, 19, 0, tzinfo=UTC))

    assert active_timer == {"plan": bedtime_plan, "started_at": "2026-11-11T19:00:00+00:00"}


def test_keeps_plan_and_clears_start_when_stopping_timer() -> None:
    bedtime_plan = {"name": "Bedtime", "end_time": "20:00:00", "tasks": [], "faff_multiplier": 1.0}
    active_timer: dict[str, Any] = {"plan": bedtime_plan, "started_at": "2026-11-11T19:00:00Z"}
    client = TimersClient("http://timers-api", create_fake_timers_api([], active_timer))

    client.stop_timer()

    assert active_timer == {"plan": bedtime_plan, "started_at": None}


@pytest.mark.parametrize("status_code", [None, 500])
def test_raises_unavailable_error_when_timers_api_fails(status_code: int | None) -> None:
    client = TimersClient("http://timers-api", create_failing_api(status_code))

    with pytest.raises(HomeApiUnavailableError):
        client.list_presets()
