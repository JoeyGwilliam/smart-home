import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

_SKILL_DIRECTORY = Path(__file__).parent
_LOCALE = "en-GB"


def check_utterances() -> bool:
    """ Checks that the deployed skill understands each phrase in `utterance-checks.json` as expected.

    Each check there has the `utterance` to try and the `intent` that Alexa must pick for it. It may also have
    `slots`: the value that Alexa must pick out for each slot name, or null to accept any value, which suits days
    and times that depend on when the check runs.

    This asks Amazon how the deployed interaction model resolves each phrase. It doesn't send anything to the
    home's server, so it is safe to run at any time.

    Returns:
        Whether every phrase was understood as expected. Each one that wasn't is printed.
    """
    # `ask deploy` records the id of the skill that it deploys to, so this always checks that same skill.
    ask_states = json.loads((_SKILL_DIRECTORY / ".ask" / "ask-states.json").read_text(encoding="utf-8"))
    skill_id = ask_states["profiles"]["default"]["skillId"]
    checks = json.loads((_SKILL_DIRECTORY / "utterance-checks.json").read_text(encoding="utf-8"))

    failures = [failure for check in checks if (failure := _find_failure(skill_id, check)) is not None]
    for failure in failures:
        print(f"FAILED  {failure}")
    print(f"{len(checks) - len(failures)} of {len(checks)} utterances were understood as expected.")
    return not failures


def _find_failure(skill_id: str, check: dict[str, Any]) -> str | None:
    # On Windows the ASK CLI is a .cmd file, which can only be run by its full path.
    command = [shutil.which("ask"), "smapi", "profile-nlu", "-s", skill_id, "-l", _LOCALE, "-u", check["utterance"]]
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
    if completed.returncode != 0:
        return f'"{check["utterance"]}": the ASK CLI failed: {completed.stderr.strip() or completed.stdout.strip()}'

    selected_intent = json.loads(completed.stdout).get("selectedIntent") or {}
    understood_slots = {name: slot.get("value") for name, slot in (selected_intent.get("slots") or {}).items()}
    expected_slots = check.get("slots", {})
    are_slots_as_expected = all(
        understood_slots.get(name) is not None and expected_value in (None, understood_slots[name])
        for name, expected_value in expected_slots.items()
    )
    if selected_intent.get("name") == check["intent"] and are_slots_as_expected:
        return None
    return (f'"{check["utterance"]}": expected {check["intent"]} {expected_slots}, '
            f'but Alexa understood {selected_intent.get("name")} {understood_slots}')


if __name__ == "__main__":
    sys.exit(0 if check_utterances() else 1)
