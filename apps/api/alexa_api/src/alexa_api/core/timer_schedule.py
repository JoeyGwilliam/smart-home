import math
from dataclasses import dataclass
from datetime import datetime, time, timedelta

from alexa_api.core.active_timer import TimerTask


@dataclass(frozen=True)
class ScheduledTask:
    """ A task with the moments it has to start and finish at for its plan to end on time.

    Attributes:
        task:
            The task.
        starts_at:
            When the task has to start.
        ends_at:
            When the task has to be finished, allowing for faffing. The next task starts at this moment.
    """

    task: TimerTask
    starts_at: datetime
    ends_at: datetime


@dataclass(frozen=True)
class TimerSchedule:
    """ When everything in a timer's plan happens.

    Attributes:
        starts_at:
            When the first task has to start. The same as `ends_at` when there are no tasks.
        ends_at:
            The moment to be ready by.
        tasks:
            Every task in the plan, first to last. Each starts as the one before it ends, and the last ends at
            `ends_at`.
    """

    starts_at: datetime
    ends_at: datetime
    tasks: tuple[ScheduledTask, ...]

    def find_current_task(self, now: datetime) -> ScheduledTask | None:
        """ Finds the task that should be happening at a moment.

        Args:
            now:
                The moment.

        Returns:
            The task, or None before the first task starts and once the moment to be ready by has come.
        """
        return next((scheduled for scheduled in self.tasks if scheduled.starts_at <= now < scheduled.ends_at), None)

    def find_next_task(self, now: datetime) -> ScheduledTask | None:
        """ Finds the next task to start after a moment.

        Args:
            now:
                The moment.

        Returns:
            The task, or None once the last task has started.
        """
        return next((scheduled for scheduled in self.tasks if scheduled.starts_at > now), None)


def schedule_timer(tasks: tuple[TimerTask, ...], faff_multiplier: float, ends_at: datetime) -> TimerSchedule:
    """ Works out when each task of a plan has to start, by stacking the tasks back from the moment to be ready by.

    Each task is given its minutes times the faff multiplier, rounded to a whole minute. This must give the same times
    as the ADHD timer page (`home_web/src/timers/scheduleTimer.ts`), so that Alexa and the screens agree.

    Args:
        tasks:
            The tasks to do one after another, first to last.
        faff_multiplier:
            How many times longer every task really takes than its duration says. At least 1.
        ends_at:
            The moment to be ready by.

    Returns:
        The schedule.
    """
    scheduled_tasks: list[ScheduledTask] = []
    next_task_starts_at = ends_at
    for task in reversed(tasks):
        # Rounding halves up, as the page does, rather than to even, as Python's round does.
        padded_minutes = max(1, math.floor(task.duration_minutes * faff_multiplier + 0.5))
        starts_at = next_task_starts_at - timedelta(minutes=padded_minutes)
        scheduled_tasks.insert(0, ScheduledTask(task, starts_at, next_task_starts_at))
        next_task_starts_at = starts_at
    return TimerSchedule(starts_at=next_task_starts_at, ends_at=ends_at, tasks=tuple(scheduled_tasks))


def find_next_end_time(end_time: time, after: datetime) -> datetime:
    """ Finds the next moment that a clock shows a time of day.

    Args:
        end_time:
            The time of day, without a time zone.
        after:
            The moment to look forward from, in the time zone whose clock to read.

    Returns:
        The first moment after `after` with that time of day: later the same day if the time is still to come, and
        the next day otherwise. In the time zone of `after`.
    """
    ends_at_same_day = datetime.combine(after.date(), end_time, tzinfo=after.tzinfo)
    return ends_at_same_day if ends_at_same_day > after else datetime.combine(after.date() + timedelta(days=1), end_time, tzinfo=after.tzinfo)
