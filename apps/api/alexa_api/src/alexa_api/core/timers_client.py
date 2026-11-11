from datetime import datetime
from typing import Any

import httpx

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
            TimerPreset(name=preset["plan"]["name"], plan=preset["plan"])
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
        plan = self._get_active_plan() if preset is None else preset.plan
        self._api.send("PUT", "/active-timer", json={"plan": plan, "started_at": started_at.isoformat()})

    def stop_timer(self) -> None:
        """ Stops the timer that every screen shows, keeping its plan. Does nothing if it isn't running. """
        self._api.send("PUT", "/active-timer", json={"plan": self._get_active_plan(), "started_at": None})

    def _get_active_plan(self) -> dict[str, Any]:
        return self._api.send("GET", "/active-timer").json()["plan"]
