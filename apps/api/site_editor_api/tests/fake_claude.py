import json
import sys
from pathlib import Path
from typing import Any

_SCRIPT_TEMPLATE = """
import json, os, sys, time
from pathlib import Path

with open({calls_path!r}, "a", encoding="utf-8") as calls_file:
    call = {{"arguments": sys.argv[1:], "message": sys.stdin.read(), "working_directory": os.getcwd()}}
    calls_file.write(json.dumps(call) + "\\n")

for path, content in json.loads({file_edits!r}).items():
    Path(path).write_text(content, encoding="utf-8")

for line in json.loads({output_lines!r}):
    print(line, flush=True)

if {hangs!r}:
    time.sleep(600)
"""


def create_fake_claude(
        directory: Path,
        records: list[dict[str, Any]],
        file_edits: dict[str, str] | None = None,
        other_output: list[str] | None = None,
        hangs: bool = False,
) -> tuple[str, ...]:
    """ Creates a stand-in for Claude Code, which behaves the same way every time it is run.

    Args:
        directory:
            Where to keep the stand-in, and its record of how it was run. Must be outside the directory it works on.
        records:
            The progress records to print, as Claude Code does in its stream-json format.
        file_edits:
            Files to write before printing anything, as content by path relative to the working directory.
        other_output:
            Lines to print after the records that are not progress, as Claude Code does for its own warnings.
        hangs:
            Whether to keep running after printing, until it is killed.

    Returns:
        The command that runs the stand-in.
    """
    script_path = directory / "fake_claude.py"
    script_path.write_text(
        _SCRIPT_TEMPLATE.format(
            calls_path=str(directory / "fake_claude_calls.jsonl"),
            file_edits=json.dumps(file_edits or {}),
            output_lines=json.dumps([json.dumps(record) for record in records] + (other_output or [])),
            hangs=hangs,
        ),
        encoding="utf-8",
    )
    return sys.executable, str(script_path)


def read_fake_claude_calls(directory: Path) -> list[dict[str, Any]]:
    """ Lists how the stand-in made by `create_fake_claude` in this directory has been run so far.

    Returns:
        One entry per run, oldest first, each with the `arguments` it was given, the `message` it was sent, and the
        `working_directory` it ran in.
    """
    calls_path = directory / "fake_claude_calls.jsonl"
    if not calls_path.exists():
        return []
    return [json.loads(line) for line in calls_path.read_text(encoding="utf-8").splitlines()]
