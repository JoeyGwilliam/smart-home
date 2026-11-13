import json
from datetime import UTC, datetime, time
from pathlib import Path
from typing import Any

import pytest

from alexa_api.core.active_timer import TimerTask
from alexa_api.core.timer_schedule import ScheduledTask, TimerSchedule, find_next_end_time, schedule_timer


def test_stacks_padded_tasks_back_from_end_when_scheduling_timer() -> None:
    dress = TimerTask("Get dressed", 10)
    teeth = TimerTask("Brush teeth", 5)
    ends_at = datetime(2026, 11, 11, 8, 30, tzinfo=UTC)

    schedule = schedule_timer((dress, teeth), faff_multiplier=1.5, ends_at=ends_at)

    assert schedule == TimerSchedule(
        starts_at=datetime(2026, 11, 11, 8, 7, tzinfo=UTC),
        ends_at=ends_at,
        tasks=(
            ScheduledTask(dress, datetime(2026, 11, 11, 8, 7, tzinfo=UTC), datetime(2026, 11, 11, 8, 22, tzinfo=UTC)),
            ScheduledTask(teeth, datetime(2026, 11, 11, 8, 22, tzinfo=UTC), ends_at),
        ),
    )


def test_starts_at_end_when_scheduling_timer_without_tasks() -> None:
    ends_at = datetime(2026, 11, 11, 17, 0, tzinfo=UTC)

    schedule = schedule_timer((), faff_multiplier=1.0, ends_at=ends_at)

    assert schedule == TimerSchedule(starts_at=ends_at, ends_at=ends_at, tasks=())


def test_finds_task_under_way_when_finding_current_task() -> None:
    dress = TimerTask("Get dressed", 10)
    teeth = TimerTask("Brush teeth", 5)
    schedule = schedule_timer((dress, teeth), faff_multiplier=1.0, ends_at=datetime(2026, 11, 11, 8, 30, tzinfo=UTC))

    current_task = schedule.find_current_task(datetime(2026, 11, 11, 8, 25, tzinfo=UTC))

    assert current_task is not None and current_task.task == teeth


def test_finds_no_task_when_finding_current_task_before_first_starts() -> None:
    dress = TimerTask("Get dressed", 10)
    schedule = schedule_timer((dress,), faff_multiplier=1.0, ends_at=datetime(2026, 11, 11, 8, 30, tzinfo=UTC))

    current_task = schedule.find_current_task(datetime(2026, 11, 11, 8, 0, tzinfo=UTC))

    assert current_task is None


def test_finds_task_still_to_start_when_finding_next_task() -> None:
    dress = TimerTask("Get dressed", 10)
    teeth = TimerTask("Brush teeth", 5)
    schedule = schedule_timer((dress, teeth), faff_multiplier=1.0, ends_at=datetime(2026, 11, 11, 8, 30, tzinfo=UTC))

    next_task = schedule.find_next_task(datetime(2026, 11, 11, 8, 20, tzinfo=UTC))

    assert next_task is not None and next_task.task == teeth


def test_ends_same_day_when_end_time_is_still_to_come() -> None:
    ends_at = find_next_end_time(time(17, 0), after=datetime(2026, 11, 11, 9, 0, tzinfo=UTC))

    assert ends_at == datetime(2026, 11, 11, 17, 0, tzinfo=UTC)


def test_ends_next_day_when_end_time_has_passed() -> None:
    ends_at = find_next_end_time(time(8, 30), after=datetime(2026, 11, 11, 9, 0, tzinfo=UTC))

    assert ends_at == datetime(2026, 11, 12, 8, 30, tzinfo=UTC)


# The ADHD timer page works out the same schedule in TypeScript (apps/home_web/src/timers/scheduleTimer.ts), and Alexa
# and the screens must agree. Both are tested against these examples, which hold every moment as the time on the
# clock, without a time zone.
_SHARED_EXAMPLES_PATH = Path(__file__).parents[3] / "timers_api" / "timer-schedule-examples.json"
_SHARED_EXAMPLES = json.loads(_SHARED_EXAMPLES_PATH.read_text(encoding="utf-8"))


def _name_example(example: dict[str, Any]) -> str:
    return example["description"]


@pytest.mark.parametrize("example", _SHARED_EXAMPLES["schedules"], ids=_name_example)
def test_gives_times_of_shared_example_when_scheduling_timer(example: dict[str, Any]) -> None:
    tasks = tuple(TimerTask(task["name"], task["duration_minutes"]) for task in example["tasks"])

    schedule = schedule_timer(tasks, example["faff_multiplier"], datetime.fromisoformat(example["ends_at"]))

    assert schedule.starts_at.isoformat() == example["starts_at"]
    assert [(scheduled.starts_at.isoformat(), scheduled.ends_at.isoformat()) for scheduled in schedule.tasks] == [
        (task["starts_at"], task["ends_at"]) for task in example["tasks"]
    ]


@pytest.mark.parametrize("example", _SHARED_EXAMPLES["next_end_times"], ids=_name_example)
def test_gives_end_time_of_shared_example_when_finding_next_end_time(example: dict[str, Any]) -> None:
    ends_at = find_next_end_time(time.fromisoformat(example["end_time"]), datetime.fromisoformat(example["after"]))

    assert ends_at.isoformat() == example["ends_at"]
