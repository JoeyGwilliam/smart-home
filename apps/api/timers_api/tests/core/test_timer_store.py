from dataclasses import replace
from datetime import UTC, datetime, time, timedelta, timezone
from pathlib import Path
from uuid import uuid7

import pytest
from sqlalchemy.exc import OperationalError

from timers_api.core.active_timer import ActiveTimer
from timers_api.core.timer_plan import TimerPlan, TimerTask
from timers_api.core.timer_preset import TimerPreset
from timers_api.core.timer_store import TimerStore


def test_returns_all_fields_when_getting_saved_preset(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    preset = TimerPreset(
        plan=TimerPlan(
            name="School run",
            end_time=time(8, 35),
            tasks=(TimerTask(name="Breakfast", duration_minutes=25), TimerTask(name="Shoes on", duration_minutes=5)),
            faff_multiplier=1.5,
        ),
    )

    store.save_preset(preset)

    assert store.get_preset(preset.id) == preset


def test_returns_tasks_in_saved_order_when_they_are_not_alphabetical(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    tasks = (TimerTask(name="Shower", duration_minutes=10), TimerTask(name="Breakfast", duration_minutes=25))
    preset = TimerPreset(plan=TimerPlan(name="School run", end_time=time(8, 35), tasks=tasks))

    store.save_preset(preset)

    assert store.get_preset(preset.id).plan.tasks == tasks


def test_returns_saved_preset_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "timers.db"
    preset = TimerPreset(plan=TimerPlan(name="School run", end_time=time(8, 35)))
    TimerStore(database_path).save_preset(preset)

    loaded_preset = TimerStore(database_path).get_preset(preset.id)

    assert loaded_preset == preset


def test_replaces_preset_when_saving_with_existing_id(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    preset = TimerPreset(
        plan=TimerPlan(
            name="School run",
            end_time=time(8, 35),
            tasks=(TimerTask(name="Breakfast", duration_minutes=25),),
            faff_multiplier=2,
        ),
    )
    store.save_preset(preset)
    edited_preset = replace(preset, plan=TimerPlan(name="Nursery run", end_time=time(9, 0)))

    store.save_preset(edited_preset)

    assert store.list_presets() == [edited_preset]


def test_returns_none_when_getting_missing_preset(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")

    loaded_preset = store.get_preset(uuid7())

    assert loaded_preset is None


def test_returns_empty_list_when_database_is_new(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "new_database.db")

    all_presets = store.list_presets()

    assert all_presets == []


def test_lists_oldest_preset_first_when_saved_out_of_order(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    oldest_preset = TimerPreset(plan=TimerPlan(name="Oldest", end_time=time(17, 0)))
    newest_preset = TimerPreset(plan=TimerPlan(name="Newest", end_time=time(17, 0)))
    store.save_preset(newest_preset)
    store.save_preset(oldest_preset)

    all_presets = store.list_presets()

    assert all_presets == [oldest_preset, newest_preset]


def test_removes_only_that_preset_when_deleting(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    preset_to_delete = TimerPreset(plan=TimerPlan(name="Delete me", end_time=time(17, 0)))
    preset_to_keep = TimerPreset(plan=TimerPlan(name="Keep me", end_time=time(17, 0)))
    store.save_preset(preset_to_delete)
    store.save_preset(preset_to_keep)

    store.delete_preset(preset_to_delete.id)

    assert store.list_presets() == [preset_to_keep]


def test_does_nothing_when_deleting_missing_preset(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    preset = TimerPreset(plan=TimerPlan(name="School run", end_time=time(8, 35)))
    store.save_preset(preset)

    store.delete_preset(uuid7())

    assert store.list_presets() == [preset]


def test_returns_stopped_timer_with_empty_plan_when_no_active_timer_has_been_saved(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")

    active_timer = store.get_active_timer()

    assert active_timer == ActiveTimer(plan=TimerPlan(name="", end_time=time(17, 0), tasks=(), faff_multiplier=1))
    assert active_timer.started_at is None


def test_returns_all_fields_when_getting_saved_active_timer(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    active_timer = ActiveTimer(
        plan=TimerPlan(
            name="School run",
            end_time=time(8, 35),
            tasks=(TimerTask(name="Breakfast", duration_minutes=25), TimerTask(name="", duration_minutes=5)),
            faff_multiplier=1.5,
        ),
        started_at=datetime(2026, 11, 11, 7, 50, 15, 123456, tzinfo=UTC),
    )

    store.save_active_timer(active_timer)

    assert store.get_active_timer() == active_timer


def test_returns_same_instant_in_utc_when_active_timer_was_started_in_another_time_zone(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    nine_am_at_plus_five = datetime(2026, 11, 11, 9, 0, tzinfo=timezone(timedelta(hours=5)))
    plan = TimerPlan(name="School run", end_time=time(8, 35))

    store.save_active_timer(ActiveTimer(plan=plan, started_at=nine_am_at_plus_five))

    loaded_started_at = store.get_active_timer().started_at
    assert loaded_started_at == nine_am_at_plus_five
    assert loaded_started_at.utcoffset() == timedelta(0)


def test_replaces_active_timer_when_another_is_saved(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    started_timer = ActiveTimer(
        plan=TimerPlan(name="School run", end_time=time(8, 35)),
        started_at=datetime(2026, 11, 11, 7, 50, tzinfo=UTC),
    )
    store.save_active_timer(started_timer)
    stopped_timer = ActiveTimer(plan=TimerPlan(name="Night out", end_time=time(19, 0)))

    store.save_active_timer(stopped_timer)

    assert store.get_active_timer() == stopped_timer


def test_returns_saved_active_timer_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "timers.db"
    active_timer = ActiveTimer(plan=TimerPlan(name="School run", end_time=time(8, 35)))
    TimerStore(database_path).save_active_timer(active_timer)

    loaded_active_timer = TimerStore(database_path).get_active_timer()

    assert loaded_active_timer == active_timer


def test_keeps_presets_when_active_timer_is_saved(tmp_path: Path) -> None:
    store = TimerStore(tmp_path / "timers.db")
    preset = TimerPreset(plan=TimerPlan(name="School run", end_time=time(8, 35)))
    store.save_preset(preset)

    store.save_active_timer(ActiveTimer(plan=TimerPlan(name="Night out", end_time=time(19, 0))))

    assert store.list_presets() == [preset]


def test_raises_operational_error_when_database_directory_does_not_exist(tmp_path: Path) -> None:
    with pytest.raises(OperationalError, match="unable to open database file"):
        TimerStore(tmp_path / "missing_directory" / "timers.db")
