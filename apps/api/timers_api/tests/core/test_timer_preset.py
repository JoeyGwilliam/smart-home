from dataclasses import replace
from datetime import time

import pytest

from timers_api.core.timer_plan import TimerPlan, TimerTask
from timers_api.core.timer_preset import TimerPreset


@pytest.mark.parametrize("blank_name", ["", "   "])
def test_raises_value_error_when_plan_name_is_blank(blank_name: str) -> None:
    unnamed_plan = TimerPlan(name=blank_name, end_time=time(17, 0))

    with pytest.raises(ValueError, match="name"):
        TimerPreset(plan=unnamed_plan)


@pytest.mark.parametrize("blank_name", ["", "   "])
def test_raises_value_error_when_task_name_is_blank(blank_name: str) -> None:
    unnamed_task = TimerTask(name=blank_name, duration_minutes=20)
    plan = TimerPlan(name="School run", end_time=time(17, 0), tasks=(unnamed_task,))

    with pytest.raises(ValueError, match="task"):
        TimerPreset(plan=plan)


def test_keeps_id_when_preset_is_copied_with_changes() -> None:
    preset = TimerPreset(plan=TimerPlan(name="School run", end_time=time(17, 0)))
    renamed_plan = TimerPlan(name="Nursery run", end_time=time(17, 0))

    edited_preset = replace(preset, plan=renamed_plan)

    assert edited_preset.id == preset.id
    assert edited_preset.plan == renamed_plan


def test_generates_different_ids_when_presets_have_identical_content() -> None:
    plan = TimerPlan(name="School run", end_time=time(17, 0))

    first_preset = TimerPreset(plan=plan)
    second_preset = TimerPreset(plan=plan)

    assert first_preset.id != second_preset.id
