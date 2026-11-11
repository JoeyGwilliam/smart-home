from collections.abc import Callable

from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest
from alexa_api.core.spoken_match import find_spoken_match
from alexa_api.core.timer_preset import TimerPreset
from alexa_api.core.timers_client import TimersClient


class TimerControls:
    """ What the skill can do with the timer on the site's ADHD timer page: start it, from a saved preset or as it
    is, stop it, and read out the saved presets.

    Attributes:
        responders:
            What to call for each intent that this handles, by the intent's name in the skill's interaction model.
            Each takes the request and gives the reply, and may raise `HomeApiUnavailableError`.
    """

    def __init__(self, timers_client: TimersClient) -> None:
        """ Creates the controls.

        Args:
            timers_client:
                The timer and presets to work on.
        """
        self._timers_client = timers_client
        self.responders: dict[str, Callable[[SkillRequest], SkillReply]] = {
            "StartPresetTimerIntent": self._start_preset_timer,
            "StartTimerIntent": self._start_timer,
            "StopTimerIntent": self._stop_timer,
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

    def _list_presets(self, request: SkillRequest) -> SkillReply:
        return SkillReply(_describe_presets(self._timers_client.list_presets()))


def _describe_presets(presets: list[TimerPreset]) -> str:
    if not presets:
        return "You have no saved timers. You can save one on the ADHD timer page."
    count = "1 saved timer" if len(presets) == 1 else f"{len(presets)} saved timers"
    return f"You have {count}. {'. '.join(preset.name for preset in presets)}."
