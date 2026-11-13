from datetime import datetime, time

import httpx

from alexa_api.core.active_timer import ActiveTimer, TimerTask
from alexa_api.core.home_api import HomeApi
from alexa_api.core.timer_preset import TimerPreset


class TimersClient:
    """ The timer that every screen in the home shows, and the saved presets for it, reached through the timers API.

    Every method raises `HomeApiUnavailableError` if the API couldn't be reached or refused what was asked.
    """

    def __init__(self, timers_api_url: str, transport: httpx.BaseTransport | None = None) -> None:
        """ Creates a client for one timers API.

        Args:
            timers_api_url:
                Address of the timers API, such as `http://timers-api:8000`.
            transport:
                How requests are sent. Only tests need to set this, to stand in for the API.
        """
        self._api = HomeApi("timers", timers_api_url, transport)

    def list_presets(self) -> list[TimerPreset]:
        """ Lists every saved preset.

        Returns:
            The presets, oldest first.
        """
        return [
            TimerPreset(id=preset["id"], name=preset["plan"]["name"])
            for preset in self._api.send("GET", "/presets").json()
        ]

    def start_timer(self, started_at: datetime, preset: TimerPreset | None = None) -> None:
        """ Starts the timer that every screen shows. A timer that is already running starts again.

        Args:
            started_at:
                Timezone-aware moment that the timer counts from.
            preset:
                The preset whose plan replaces the timer's plan. None to start the plan that the timer already has.
        """
        preset_id = None if preset is None else preset.id
        self._api.send("POST", "/active-timer/start", json={"started_at": started_at.isoformat(), "preset_id": preset_id})

    def get_active_timer(self) -> ActiveTimer:
        """ Finds the timer that every screen shows, as it is now.

        Returns:
            The timer, with its plan and whether it has been started.
        """
        active_timer = self._api.send("GET", "/active-timer").json()
        plan = active_timer["plan"]
        started_at = active_timer["started_at"]
        return ActiveTimer(
            name=plan["name"],
            end_time=time.fromisoformat(plan["end_time"]),
            tasks=tuple(TimerTask(task["name"], task["duration_minutes"]) for task in plan["tasks"]),
            faff_multiplier=plan["faff_multiplier"],
            started_at=None if started_at is None else datetime.fromisoformat(started_at),
        )

    def stop_timer(self) -> None:
        """ Stops the timer that every screen shows, keeping its plan. Does nothing if it isn't running. """
        self._api.send("POST", "/active-timer/stop")
