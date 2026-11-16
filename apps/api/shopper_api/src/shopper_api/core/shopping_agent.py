import json
import os
import subprocess
import sys
import threading
from collections import deque
from collections.abc import Callable, Iterator, Sequence
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .claude_settings import ClaudeSettings
from .draft_order import ItemChoice, ShoppingReport
from .progress_event import ProgressEvent, ProgressKind
from .shopping_failed_error import ShoppingFailedError
from .shopping_list_item import ShoppingListItem

_INSTRUCTIONS = """
You are doing a household's grocery shop at Morrisons online, with the Morrisons tools, which are the only tools you
have. The trolley has been emptied for you. A person will check the trolley afterwards and order it themselves, so
never try to check out, book a delivery slot or pay; you can't.

Shop for exactly the shopping list you are given, and nothing else:
- Each item says how many of it to buy. "2 × 500g lamb mince" means 1kg of lamb mince in all, in whichever packs are
  the best value. Most items come from recipes' ingredients, so buy enough to cover what is written, not one pack each.
- Choose by price per unit unless the item names a brand or a kind. Prefer a product with an offer when it is a fair
  match, and make the most of multi-buy offers, checking `offer_progress` in the trolley.
- The household may give its preferences, such as brands it likes or things it avoids. Follow them when choosing, ahead
  of the rules above, and say in an item's note when one decided what you chose. They never add anything to the list
  or take anything off it.
- If nothing is a fair match, add nothing for that item and say so, rather than guessing. If what was asked for is out
  of stock, choose a close substitute and say that it is one. Skip only what a shop doesn't sell, such as water.
- Finish by checking the trolley with `view_trolley`, then give your report: one entry for each item on the list, in
  the list's order, with the item written exactly as it was given. Write it for the person, in short plain English.
""".strip()

# A shop with many items takes many tool calls, each of which is a few seconds of browsing. This is far longer than one
# should take, so that only a shop that has gone wrong is cut short.
_TIME_LIMIT_SECONDS = 30 * 60

# The most that one shop may cost in Claude usage, in US dollars, so that a shop that goes round in circles stops.
_MAXIMUM_COST_IN_DOLLARS = 5

# How much of what Claude Code printed, other than its progress, is kept to explain an unexpected exit.
_DIAGNOSTIC_LINE_COUNT = 20

_MORRISONS_SERVER_NAME = "morrisons"
_MORRISONS_TOOL_PREFIX = f"mcp__{_MORRISONS_SERVER_NAME}__"

# Starts the Morrisons MCP server with this process's own Python, which has it installed.
_MORRISONS_SERVER_COMMAND = (sys.executable, "-c", "from morrisons_mcp.server.main import run; run()")


class _ItemChoiceJson(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item: str = Field(description="The item of the shopping list, written exactly as it was given.")
    products: list[str] = Field(
        description="What you put in the trolley for it, each with how many, such as '2 × Morrisons Lamb Mince 250g'. "
                    "Empty if you found nothing suitable.",
    )
    note: str = Field(description="Why you chose them, or why you chose nothing, in a sentence or two.")


class _ShoppingReportJson(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(
        description="How the shop went overall, and anything the person should look at before ordering, in a few "
                    "sentences.",
    )
    item_choices: list[_ItemChoiceJson] = Field(description="One for each item of the shopping list, in its order.")


class ShoppingAgent:
    """ Claude, shopping at Morrisons for a shopping list by filling the trolley, with nothing but the tools of the
    Morrisons MCP server. Those can't order anything, and Claude can't touch this machine's files or run commands.

    Each shop starts Claude Code on this machine, as whoever runs this process, so it uses that person's login.
    """

    def __init__(
            self,
            working_directory: Path,
            claude_command: Sequence[str] = ("claude",),
            time_limit_seconds: float = _TIME_LIMIT_SECONDS,
    ) -> None:
        """ Prepares the agent. Nothing is started until `shop` is called.

        Args:
            working_directory:
                Where Claude Code runs. It reads nothing there, but it must not be a project with instructions of its
                own, such as this repository, as Claude Code would follow them.
            claude_command:
                The command that starts Claude Code, as a program followed by any arguments it always needs.
            time_limit_seconds:
                The longest a shop may take before it is stopped.
        """
        self._working_directory = working_directory
        self._claude_command = claude_command
        self._time_limit_seconds = time_limit_seconds
        self._process: subprocess.Popen[str] | None = None
        self._stop_reason: str | None = None
        # Makes stopping and starting Claude Code take turns, so that a stop can't slip in between deciding to start
        # it and having a process to kill.
        self._process_lock = threading.Lock()

    def shop(
            self,
            shopping_list: Sequence[ShoppingListItem],
            settings: ClaudeSettings,
            record_progress: Callable[[ProgressEvent], None],
    ) -> ShoppingReport:
        """ Has Claude fill the Morrisons trolley from a shopping list, and returns once it has finished.

        Only one shop can be in progress at a time.

        Args:
            shopping_list:
                What to buy. Must not be empty.
            settings:
                How Claude should work.
            record_progress:
                Called with each step that Claude takes, and each thing it says, as it happens.

        Returns:
            Claude's account of what it chose. The trolley itself is the truth about what it holds.

        Raises:
            ShoppingFailedError: If Claude couldn't finish, was stopped, or took too long.
            OSError: If Claude Code could not be started, which happens when it isn't installed.
        """
        with self._process_lock:
            self._stop_reason = None
            self._process = subprocess.Popen(
                self._build_command(settings),
                cwd=self._working_directory,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                # Errors are read from the same stream as progress, so that neither can fill up unread and stall Claude.
                stderr=subprocess.STDOUT,
                encoding="utf-8",
                errors="replace",
            )
            process = self._process

        time_limit = threading.Timer(
            self._time_limit_seconds,
            self._stop_because,
            [f"Claude took longer than {self._time_limit_seconds / 60:g} minutes, so it was stopped."],
        )
        time_limit.start()
        try:
            # The list goes in through stdin rather than as an argument, so that no quoting rules can mangle it.
            process.stdin.write(_describe_shop(shopping_list, settings.preferences))
            process.stdin.close()
            return self._follow_claude(process, record_progress)
        finally:
            time_limit.cancel()
            with self._process_lock:
                self._process = None
            process.kill()
            process.wait()
            process.stdout.close()

    def stop(self) -> None:
        """ Interrupts the shop in progress, if there is one, which then fails. What is in the trolley stays there. """
        self._stop_because("Stopped before Claude had finished. The trolley holds whatever it had added by then.")

    def _stop_because(self, reason: str) -> None:
        with self._process_lock:
            if self._process is not None:
                self._stop_reason = reason
                self._process.kill()

    def _build_command(self, settings: ClaudeSettings) -> list[str]:
        morrisons_server = {
            "command": _MORRISONS_SERVER_COMMAND[0],
            "args": list(_MORRISONS_SERVER_COMMAND[1:]),
            # The server reads where to deliver to from these, which this process was started with.
            "env": {name: value for name, value in os.environ.items() if name.startswith("MORRISONS_")},
        }
        return [
            *self._claude_command,
            "--print",
            "--output-format", "stream-json",
            # Claude Code only prints progress as it happens in verbose mode.
            "--verbose",
            "--no-session-persistence",
            # Claude gets the Morrisons tools and nothing else: no other MCP servers, and none of Claude Code's own
            # tools, so it can't read or change files or run commands.
            "--strict-mcp-config",
            "--mcp-config", json.dumps({"mcpServers": {_MORRISONS_SERVER_NAME: morrisons_server}}),
            "--tools", "",
            "--allowedTools", f"mcp__{_MORRISONS_SERVER_NAME}",
            "--append-system-prompt", _INSTRUCTIONS,
            "--json-schema", json.dumps(_ShoppingReportJson.model_json_schema()),
            "--max-budget-usd", str(_MAXIMUM_COST_IN_DOLLARS),
            "--model", settings.model,
            "--effort", settings.effort,
        ]

    def _follow_claude(
            self,
            process: subprocess.Popen[str],
            record_progress: Callable[[ProgressEvent], None],
    ) -> ShoppingReport:
        """ Passes on Claude's progress until it exits, and returns the report it finished with. """
        diagnostic_lines = deque(maxlen=_DIAGNOSTIC_LINE_COUNT)
        final_record = None
        for line in process.stdout:
            record = _parse_record(line)
            if record is None:
                diagnostic_lines.append(line.rstrip())
                continue
            if record.get("type") == "result":
                final_record = record
            for event in _describe_record(record):
                record_progress(event)

        process.wait()
        if self._stop_reason:
            raise ShoppingFailedError(self._stop_reason)
        if final_record is None:
            diagnostics = "\n".join(diagnostic_lines)
            raise ShoppingFailedError(f"Claude stopped unexpectedly.\n{diagnostics}".strip())
        if final_record.get("is_error"):
            raise ShoppingFailedError(final_record.get("result") or "Claude could not finish.")
        return _read_report(final_record)


def _describe_shop(shopping_list: Sequence[ShoppingListItem], preferences: str) -> str:
    """ Writes the message that tells Claude what to buy, followed by how the household likes to shop, if it has said. """
    lines = []
    for item in shopping_list:
        recipes = f" (for {', '.join(item.needed_for)})" if item.needed_for else ""
        lines.append(f"- {item.quantity} × {item.name}{recipes}")
    message = "Shop for this shopping list:\n" + "\n".join(lines)
    if preferences:
        message += f"\n\nThe household's preferences:\n{preferences}"
    return message


def _read_report(final_record: dict[str, Any]) -> ShoppingReport:
    """ Reads the report that Claude finished with, which `--json-schema` makes it give in a known shape. """
    report_json = final_record.get("structured_output")
    try:
        if report_json is None:
            # Claude Code puts the report in its own field, but a version that doesn't would give it as the answer.
            report_json = json.loads(final_record.get("result") or "")
        report = _ShoppingReportJson.model_validate(report_json)
    except (json.JSONDecodeError, ValidationError) as error:
        raise ShoppingFailedError(f"Claude finished, but its report of what it chose couldn't be read.\n{error}") from error

    return ShoppingReport(
        summary=report.summary,
        item_choices=tuple(ItemChoice(choice.item, tuple(choice.products), choice.note) for choice in report.item_choices),
    )


def _parse_record(line: str) -> dict[str, Any] | None:
    """ Reads one line of Claude Code's output. Returns None if it isn't one of the records that report progress. """
    try:
        record = json.loads(line)
    except json.JSONDecodeError:
        # Anything that isn't JSON is a message from Claude Code itself, such as a warning, rather than progress.
        return None
    return record if isinstance(record, dict) else None


def _describe_record(record: dict[str, Any]) -> Iterator[ProgressEvent]:
    """ Converts one record of Claude Code's output to the events it reports. Most kinds of record report none. """
    if record.get("type") != "assistant":
        return
    for block in record["message"]["content"]:
        if block["type"] == "tool_use":
            yield ProgressEvent(ProgressKind.ACTIVITY, _describe_tool_use(block["name"], block["input"]))
        elif block["type"] == "text" and block["text"].strip():
            yield ProgressEvent(ProgressKind.REPLY, block["text"].strip())


def _describe_tool_use(tool_name: str, tool_input: dict[str, Any]) -> str:
    """ Describes one use of a tool by Claude, such as "Searching for lamb mince". """
    match tool_name.removeprefix(_MORRISONS_TOOL_PREFIX):
        case "search_products" if tool_input.get("only_on_offer"):
            return f"Searching for offers on {tool_input.get('query', 'something')}"
        case "search_products":
            return f"Searching for {tool_input.get('query', 'something')}"
        case "list_products_in_offer":
            return "Looking at everything in an offer"
        case "list_featured_offers":
            return "Looking at Morrisons' offers"
        case "add_to_trolley":
            return f"Adding {tool_input.get('quantity', 1)} to the trolley"
        case "remove_from_trolley":
            return "Taking something out of the trolley"
        case "view_trolley":
            return "Checking the trolley"
        case "empty_trolley":
            return "Emptying the trolley"
        case "StructuredOutput":
            return "Writing up what it chose"
        case other_tool_name:
            return f"Using {other_tool_name}"
