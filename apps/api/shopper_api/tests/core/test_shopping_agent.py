import json
from pathlib import Path

import pytest

from shopper_api.core.claude_settings import ClaudeEffort, ClaudeModel, ClaudeSettings
from shopper_api.core.draft_order import ItemChoice, ShoppingReport
from shopper_api.core.progress_event import ProgressEvent, ProgressKind
from shopper_api.core.shopping_agent import ShoppingAgent
from shopper_api.core.shopping_failed_error import ShoppingFailedError
from shopper_api.core.shopping_list_item import ShoppingListItem
from tests.fake_claude import create_fake_claude, read_fake_claude_calls

MILK = ShoppingListItem("Milk", 1, ())
LAMB_MINCE = ShoppingListItem("500g lamb mince", 2, ("Shepherd's pie", "Lasagne"))

MILK_REPORT_JSON = {
    "summary": "All found.",
    "item_choices": [{"item": "Milk", "products": ["1 × Morrisons Milk 2L"], "note": "Cheapest per litre."}],
}
FINISHED_WITH_MILK_REPORT = {"type": "result", "is_error": False, "structured_output": MILK_REPORT_JSON}


def shop_with_fake_claude(tmp_path: Path, records: list[dict], shopping_list=(MILK,)) -> tuple[ShoppingReport, list[ProgressEvent]]:
    """ Has an agent whose Claude prints `records` shop for `shopping_list`, and returns its report and progress. """
    agent = ShoppingAgent(tmp_path, claude_command=create_fake_claude(tmp_path, records))
    events = []
    report = agent.shop(shopping_list, ClaudeSettings(), events.append)
    return report, events


def test_returns_report_when_claude_finishes_with_one(tmp_path: Path) -> None:
    report, _ = shop_with_fake_claude(tmp_path, [FINISHED_WITH_MILK_REPORT])

    assert report == ShoppingReport("All found.", (ItemChoice("Milk", ("1 × Morrisons Milk 2L",), "Cheapest per litre."),))


def test_reads_report_from_answer_when_claude_gives_it_there(tmp_path: Path) -> None:
    records = [{"type": "result", "is_error": False, "result": json.dumps(MILK_REPORT_JSON)}]

    report, _ = shop_with_fake_claude(tmp_path, records)

    assert report.summary == "All found."


def test_records_activity_naming_search_when_claude_searches(tmp_path: Path) -> None:
    tool_use = {"type": "tool_use", "name": "mcp__morrisons__search_products", "input": {"query": "semi skimmed milk"}}
    records = [{"type": "assistant", "message": {"content": [tool_use]}}, FINISHED_WITH_MILK_REPORT]

    _, events = shop_with_fake_claude(tmp_path, records)

    assert events == [ProgressEvent(ProgressKind.ACTIVITY, "Searching for semi skimmed milk")]


def test_records_reply_when_claude_says_something(tmp_path: Path) -> None:
    text = {"type": "text", "text": "Milk is on offer. "}
    records = [{"type": "assistant", "message": {"content": [text]}}, FINISHED_WITH_MILK_REPORT]

    _, events = shop_with_fake_claude(tmp_path, records)

    assert events == [ProgressEvent(ProgressKind.REPLY, "Milk is on offer.")]


def test_raises_with_reason_when_result_is_error(tmp_path: Path) -> None:
    with pytest.raises(ShoppingFailedError, match="Usage limit reached."):
        shop_with_fake_claude(tmp_path, [{"type": "result", "is_error": True, "result": "Usage limit reached."}])


def test_raises_when_report_is_missing(tmp_path: Path) -> None:
    with pytest.raises(ShoppingFailedError, match="report"):
        shop_with_fake_claude(tmp_path, [{"type": "result", "is_error": False, "result": "Done!"}])


def test_raises_with_other_output_when_claude_exits_without_result(tmp_path: Path) -> None:
    agent = ShoppingAgent(tmp_path, claude_command=create_fake_claude(tmp_path, [], other_output=["Error: not logged in"]))

    with pytest.raises(ShoppingFailedError, match="Error: not logged in"):
        agent.shop([MILK], ClaudeSettings(), lambda event: None)


def test_raises_saying_it_was_stopped_when_stopped(tmp_path: Path) -> None:
    records = [{"type": "assistant", "message": {"content": [{"type": "text", "text": "Starting."}]}}]
    agent = ShoppingAgent(tmp_path, claude_command=create_fake_claude(tmp_path, records, hangs=True))

    with pytest.raises(ShoppingFailedError, match="Stopped"):
        agent.shop([MILK], ClaudeSettings(), lambda event: agent.stop())


def test_raises_saying_it_took_too_long_when_time_limit_passes(tmp_path: Path) -> None:
    agent = ShoppingAgent(tmp_path, claude_command=create_fake_claude(tmp_path, [], hangs=True), time_limit_seconds=0.5)

    with pytest.raises(ShoppingFailedError, match="took longer than"):
        agent.shop([MILK], ClaudeSettings(), lambda event: None)


def test_gives_claude_shopping_list_with_quantities_and_recipes_when_shopping(tmp_path: Path) -> None:
    shop_with_fake_claude(tmp_path, [FINISHED_WITH_MILK_REPORT], shopping_list=(MILK, LAMB_MINCE))

    [call] = read_fake_claude_calls(tmp_path)
    assert call["message"] == "Shop for this shopping list:\n- 1 × Milk\n- 2 × 500g lamb mince (for Shepherd's pie, Lasagne)"


def test_gives_claude_only_morrisons_tools_when_shopping(tmp_path: Path) -> None:
    shop_with_fake_claude(tmp_path, [FINISHED_WITH_MILK_REPORT])

    [call] = read_fake_claude_calls(tmp_path)
    arguments = call["arguments"]
    assert "--strict-mcp-config" in arguments
    assert arguments[arguments.index("--tools") + 1] == ""
    assert arguments[arguments.index("--allowedTools") + 1] == "mcp__morrisons"
    assert list(json.loads(arguments[arguments.index("--mcp-config") + 1])["mcpServers"]) == ["morrisons"]


def test_asks_for_model_and_effort_when_settings_name_them(tmp_path: Path) -> None:
    agent = ShoppingAgent(tmp_path, claude_command=create_fake_claude(tmp_path, [FINISHED_WITH_MILK_REPORT]))

    agent.shop([MILK], ClaudeSettings(ClaudeModel.OPUS, ClaudeEffort.HIGH), lambda event: None)

    [call] = read_fake_claude_calls(tmp_path)
    assert call["arguments"][call["arguments"].index("--model") + 1] == "opus"
    assert call["arguments"][call["arguments"].index("--effort") + 1] == "high"


def test_gives_claude_preferences_after_shopping_list_when_settings_have_them(tmp_path: Path) -> None:
    agent = ShoppingAgent(tmp_path, claude_command=create_fake_claude(tmp_path, [FINISHED_WITH_MILK_REPORT]))

    agent.shop([MILK], ClaudeSettings(preferences="Organic milk only."), lambda event: None)

    [call] = read_fake_claude_calls(tmp_path)
    assert call["message"].endswith("- 1 × Milk\n\nThe household's preferences:\nOrganic milk only.")
