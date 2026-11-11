from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest
from alexa_api.core.timer_controls import TimerControls
from alexa_api.core.timers_client import TimersClient
from tests.fake_home_apis import create_fake_timers_api

_QUARTER_TO_EIGHT = datetime(2026, 11, 11, 7, 45, tzinfo=UTC)

_SCHOOL_RUN_PLAN = {"name": "School run", "end_time": "08:30:00", "tasks": [], "faff_multiplier": 1.5}
_BEDTIME_PLAN = {"name": "Bedtime", "end_time": "20:00:00", "tasks": [], "faff_multiplier": 1.0}

# With the faff multiplier, these run from 7:59 to 8:14, 8:14 to 8:22 and 8:22 to 8:30 (UTC, which is London time in
# November).
_SCHOOL_RUN_PLAN_WITH_TASKS = {
    "name": "School run",
    "end_time": "08:30:00",
    "tasks": [
        {"id": "dress", "name": "Get dressed", "duration_minutes": 10},
        {"id": "teeth", "name": "Brush teeth", "duration_minutes": 5},
        {"id": "shoes", "name": "Put shoes on", "duration_minutes": 5},
    ],
    "faff_multiplier": 1.5,
}


def _respond(held_presets: list[dict[str, Any]], active_timer: dict[str, Any], request: SkillRequest) -> SkillReply:
    timers_client = TimersClient("http://timers-api", create_fake_timers_api(held_presets, active_timer))
    controls = TimerControls(timers_client, ZoneInfo("Europe/London"))
    return controls.responders[request.name](request)


def test_starts_timer_with_matching_presets_plan_when_preset_timer_is_started() -> None:
    held_presets = [{"id": "school-run", "plan": _SCHOOL_RUN_PLAN}, {"id": "bedtime", "plan": _BEDTIME_PLAN}]
    active_timer: dict[str, Any] = {"plan": _BEDTIME_PLAN, "started_at": None}

    reply = _respond(held_presets, active_timer, SkillRequest("StartPresetTimerIntent", _QUARTER_TO_EIGHT, slots={"preset": "school run"}))

    assert reply == SkillReply("I've started the School run timer.")
    assert active_timer == {"plan": _SCHOOL_RUN_PLAN, "started_at": "2026-11-11T07:45:00+00:00"}


def test_leaves_timer_alone_and_reads_out_presets_when_no_preset_matches() -> None:
    held_presets = [{"id": "school-run", "plan": _SCHOOL_RUN_PLAN}, {"id": "bedtime", "plan": _BEDTIME_PLAN}]
    active_timer: dict[str, Any] = {"plan": _BEDTIME_PLAN, "started_at": None}

    reply = _respond(held_presets, active_timer, SkillRequest("StartPresetTimerIntent", _QUARTER_TO_EIGHT, slots={"preset": "swimming"}))

    assert reply == SkillReply("I couldn't find a saved timer like swimming. You have 2 saved timers. School run. Bedtime.")
    assert active_timer == {"plan": _BEDTIME_PLAN, "started_at": None}


def test_says_timer_was_not_caught_when_no_preset_name_is_heard() -> None:
    held_presets = [{"id": "bedtime", "plan": _BEDTIME_PLAN}]
    active_timer: dict[str, Any] = {"plan": _BEDTIME_PLAN, "started_at": None}

    reply = _respond(held_presets, active_timer, SkillRequest("StartPresetTimerIntent", _QUARTER_TO_EIGHT))

    assert reply == SkillReply("Sorry, I didn't catch which timer you meant. You have 1 saved timer. Bedtime.")
    assert active_timer == {"plan": _BEDTIME_PLAN, "started_at": None}


def test_starts_timer_with_its_own_plan_when_timer_is_started_without_preset() -> None:
    active_timer: dict[str, Any] = {"plan": _BEDTIME_PLAN, "started_at": None}

    reply = _respond([], active_timer, SkillRequest("StartTimerIntent", _QUARTER_TO_EIGHT))

    assert reply == SkillReply("I've started the timer.")
    assert active_timer == {"plan": _BEDTIME_PLAN, "started_at": "2026-11-11T07:45:00+00:00"}


def test_stops_timer_and_keeps_its_plan_when_timer_is_stopped() -> None:
    active_timer: dict[str, Any] = {"plan": _BEDTIME_PLAN, "started_at": "2026-11-11T07:00:00Z"}

    reply = _respond([], active_timer, SkillRequest("StopTimerIntent", _QUARTER_TO_EIGHT))

    assert reply == SkillReply("I've stopped the timer.")
    assert active_timer == {"plan": _BEDTIME_PLAN, "started_at": None}


def test_reads_out_preset_names_when_listing_presets() -> None:
    held_presets = [{"id": "school-run", "plan": _SCHOOL_RUN_PLAN}, {"id": "bedtime", "plan": _BEDTIME_PLAN}]

    reply = _respond(held_presets, {}, SkillRequest("ListTimerPresetsIntent", _QUARTER_TO_EIGHT))

    assert reply == SkillReply("You have 2 saved timers. School run. Bedtime.")


def test_says_where_to_save_a_timer_when_listing_with_no_presets() -> None:
    reply = _respond([], {}, SkillRequest("ListTimerPresetsIntent", _QUARTER_TO_EIGHT))

    assert reply == SkillReply("You have no saved timers. You can save one on the ADHD timer page.")


def test_says_task_and_time_left_when_timer_is_on_a_task() -> None:
    active_timer = {"plan": _SCHOOL_RUN_PLAN_WITH_TASKS, "started_at": "2026-11-11T07:30:00Z"}

    reply = _respond([], active_timer, SkillRequest("CheckTimerIntent", datetime(2026, 11, 11, 8, 20, tzinfo=UTC)))

    assert reply == SkillReply("The School run timer is on Brush teeth, with 2 minutes left. Then it's Put shoes on. You need to be ready by 8:30 AM.")


def test_says_it_is_the_last_task_when_timer_is_on_its_last_task() -> None:
    active_timer = {"plan": _SCHOOL_RUN_PLAN_WITH_TASKS, "started_at": "2026-11-11T07:30:00Z"}

    reply = _respond([], active_timer, SkillRequest("CheckTimerIntent", datetime(2026, 11, 11, 8, 29, 50, tzinfo=UTC)))

    assert reply == SkillReply("The School run timer is on Put shoes on, with less than a minute left. That's the last task. You need to be ready by 8:30 AM.")


def test_says_when_first_task_starts_when_timer_is_running_before_its_first_task() -> None:
    active_timer = {"plan": _SCHOOL_RUN_PLAN_WITH_TASKS, "started_at": "2026-11-11T07:30:00Z"}

    reply = _respond([], active_timer, SkillRequest("CheckTimerIntent", _QUARTER_TO_EIGHT))

    assert reply == SkillReply("The School run timer is running. Get dressed starts at 7:59 AM. You need to be ready by 8:30 AM.")


def test_says_timer_has_finished_when_end_time_has_passed() -> None:
    active_timer = {"plan": _SCHOOL_RUN_PLAN_WITH_TASKS, "started_at": "2026-11-11T07:30:00Z"}

    reply = _respond([], active_timer, SkillRequest("CheckTimerIntent", datetime(2026, 11, 11, 9, 0, tzinfo=UTC)))

    assert reply == SkillReply("The School run timer has finished. It was set to be ready by 8:30 AM.")


def test_says_timer_is_stopped_when_timer_has_not_been_started() -> None:
    active_timer = {"plan": _SCHOOL_RUN_PLAN_WITH_TASKS, "started_at": None}

    reply = _respond([], active_timer, SkillRequest("CheckTimerIntent", _QUARTER_TO_EIGHT))

    assert reply == SkillReply("The School run timer is stopped. It's set to be ready by 8:30 AM.")


def test_reads_end_time_on_home_clock_when_home_is_on_summer_time() -> None:
    active_timer = {
        "plan": {"name": "", "end_time": "17:00:00", "tasks": [], "faff_multiplier": 1.0},
        "started_at": "2026-07-01T14:00:00Z",
    }

    reply = _respond([], active_timer, SkillRequest("CheckTimerIntent", datetime(2026, 7, 1, 14, 30, tzinfo=UTC)))

    assert reply == SkillReply("The timer is running. You need to be ready by 5 PM.")
