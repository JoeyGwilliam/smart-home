import math
from collections.abc import Callable
from datetime import datetime
from zoneinfo import ZoneInfo

from alexa_api.core.active_timer import ActiveTimer
from alexa_api.core.due_time import describe_time_of_day
from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest
from alexa_api.core.spoken_match import find_spoken_match
from alexa_api.core.timer_preset import TimerPreset
from alexa_api.core.timer_schedule import ScheduledTask, find_next_end_time, schedule_timer
from alexa_api.core.timers_client import TimersClient


class TimerControls:
    """ What the skill can do with the timer on the site's ADHD timer page: start it, from a saved preset or as it
    is, stop it, say what it is on, and read out the saved presets.

    Attributes:
        responders:
            What to call for each intent that this handles, by the intent's name in the skill's interaction model.
            Each takes the request and gives the reply, and may raise `HomeApiUnavailableError`.
    """

    def __init__(self, timers_client: TimersClient, home_time_zone: ZoneInfo) -> None:
        """ Creates the controls.

        Args:
            timers_client:
                The timer and presets to work on.
            home_time_zone:
                The time zone of the home's clocks, which the timer's end time is read on and times are read out in.
        """
        self._timers_client = timers_client
        self._home_time_zone = home_time_zone
        self.responders: dict[str, Callable[[SkillRequest], SkillReply]] = {
            "StartPresetTimerIntent": self._start_preset_timer,
            "StartTimerIntent": self._start_timer,
            "StopTimerIntent": self._stop_timer,
            "CheckTimerIntent": self._check_timer,
            "ListTimerPresetsIntent": self._list_presets,
        }

    def _start_preset_timer(self, request: SkillRequest) -> SkillReply:
        presets = self._timers_client.list_presets()
        spoken_name = request.slots.get("preset", "").strip()
        preset = find_spoken_match(spoken_name, presets, lambda preset: preset.name)
        if preset is None:
            not_found = f"I couldn't find a saved timer like {spoken_name}." if spoken_name else "Sorry, I didn't catch which timer you meant."
            return SkillReply(f"{not_found} {_describe_presets(presets)}")

        self._timers_client.start_timer(request.received_at, preset)
        return SkillReply(f"I've started the {preset.name} timer.")

    def _start_timer(self, request: SkillRequest) -> SkillReply:
        self._timers_client.start_timer(request.received_at)
        return SkillReply("I've started the timer.")

    def _stop_timer(self, request: SkillRequest) -> SkillReply:
        self._timers_client.stop_timer()
        return SkillReply("I've stopped the timer.")

    def _check_timer(self, request: SkillRequest) -> SkillReply:
        timer = self._timers_client.get_active_timer()
        now = request.received_at.astimezone(self._home_time_zone)
        return SkillReply(_describe_timer(timer, now))

    def _list_presets(self, request: SkillRequest) -> SkillReply:
        return SkillReply(_describe_presets(self._timers_client.list_presets()))


def _describe_presets(presets: list[TimerPreset]) -> str:
    if not presets:
        return "You have no saved timers. You can save one on the ADHD timer page."
    count = "1 saved timer" if len(presets) == 1 else f"{len(presets)} saved timers"
    return f"You have {count}. {'. '.join(preset.name for preset in presets)}."


def _describe_timer(timer: ActiveTimer, now: datetime) -> str:
    timer_name = f"The {timer.name.strip()} timer" if timer.name.strip() else "The timer"
    if timer.started_at is None:
        ends_at = find_next_end_time(timer.end_time, now)
        return f"{timer_name} is stopped. It's set to be ready by {describe_time_of_day(ends_at)}."

    # Starting the timer settles which day it ends on, so that it stays finished once the end time has passed, rather
    # than moving on to tomorrow. The ADHD timer page decides it the same way.
    ends_at = find_next_end_time(timer.end_time, timer.started_at.astimezone(now.tzinfo))
    ready_by = describe_time_of_day(ends_at)
    if now >= ends_at:
        return f"{timer_name} has finished. It was set to be ready by {ready_by}."

    schedule = schedule_timer(timer.tasks, timer.faff_multiplier, ends_at)
    current_task = schedule.find_current_task(now)
    next_task = schedule.find_next_task(now)
    if current_task is None:
        first_task = f" {_capitalise_first_letter(_name_task(next_task))} starts at {describe_time_of_day(next_task.starts_at)}." if next_task else ""
        return f"{timer_name} is running.{first_task} You need to be ready by {ready_by}."

    minutes_left = _describe_minutes(math.floor((current_task.ends_at - now).total_seconds() / 60 + 0.5))
    after_that = f" Then it's {_name_task(next_task)}." if next_task else " That's the last task."
    return f"{timer_name} is on {_name_task(current_task)}, with {minutes_left} left.{after_that} You need to be ready by {ready_by}."


def _name_task(scheduled_task: ScheduledTask) -> str:
    return scheduled_task.task.name.strip() or "the next task"


def _capitalise_first_letter(phrase: str) -> str:
    # Unlike str.capitalize, this leaves the rest of a task's name as the person wrote it.
    return phrase[:1].upper() + phrase[1:]


def _describe_minutes(total_minutes: int) -> str:
    if total_minutes < 1:
        return "less than a minute"
    hours, minutes = divmod(total_minutes, 60)
    parts = [f"{count} {unit}{'' if count == 1 else 's'}" for count, unit in ((hours, "hour"), (minutes, "minute")) if count > 0]
    return " and ".join(parts)
