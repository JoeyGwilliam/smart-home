from datetime import UTC, time

import pytest

from timers_api.core.timer_plan import TimerPlan, TimerTask


@pytest.mark.parametrize("too_short_duration", [0, -5])
def test_raises_value_error_when_task_duration_is_less_than_a_minute(too_short_duration: int) -> None:
    with pytest.raises(ValueError, match="duration_minutes"):
        TimerTask(name="Doing makeup", duration_minutes=too_short_duration)


def test_accepts_task_when_name_is_blank() -> None:
    task = TimerTask(name="", duration_minutes=20)

    assert task.name == ""


def test_generates_different_ids_when_tasks_have_identical_content() -> None:
    first_task = TimerTask(name="Doing makeup", duration_minutes=20)
    second_task = TimerTask(name="Doing makeup", duration_minutes=20)

    assert first_task.id != second_task.id


def test_raises_value_error_when_end_time_has_time_zone() -> None:
    end_time_with_time_zone = time(17, 0, tzinfo=UTC)

    with pytest.raises(ValueError, match="end_time"):
        TimerPlan(name="School run", end_time=end_time_with_time_zone)


def test_raises_value_error_when_two_tasks_share_an_id() -> None:
    task = TimerTask(name="Doing makeup", duration_minutes=20)

    with pytest.raises(ValueError, match="ids"):
        TimerPlan(name="School run", end_time=time(17, 0), tasks=(task, task))


@pytest.mark.parametrize("invalid_faff_multiplier", [0.99, 0, -2, float("nan"), float("inf")])
def test_raises_value_error_when_faff_multiplier_is_not_a_finite_number_of_at_least_one(
    invalid_faff_multiplier: float,
) -> None:
    with pytest.raises(ValueError, match="faff_multiplier"):
        TimerPlan(name="School run", end_time=time(17, 0), faff_multiplier=invalid_faff_multiplier)


def test_has_no_tasks_and_no_faffing_when_only_name_and_end_time_are_given() -> None:
    plan = TimerPlan(name="School run", end_time=time(17, 0))

    assert plan.tasks == ()
    assert plan.faff_multiplier == 1


def test_accepts_plan_when_name_is_blank() -> None:
    plan = TimerPlan(name="", end_time=time(17, 0))

    assert plan.name == ""
