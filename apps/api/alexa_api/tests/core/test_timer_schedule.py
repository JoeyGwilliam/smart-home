from datetime import UTC, datetime, time

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
