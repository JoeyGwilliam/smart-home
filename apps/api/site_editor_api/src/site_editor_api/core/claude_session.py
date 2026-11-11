import json
import subprocess
import threading
from collections import deque
from collections.abc import Iterator, Sequence
from pathlib import Path, PureWindowsPath
from typing import Any

from .claude_settings import ClaudeSettings
from .progress_event import ProgressEvent, ProgressKind

# How much of what Claude Code printed, other than its progress, is kept to explain an unexpected exit.
_DIAGNOSTIC_LINE_COUNT = 20

# The longest command that is shown in full in an activity.
_MAXIMUM_COMMAND_LENGTH = 80


class ClaudeSession:
    """ A conversation with Claude Code, which reads and changes the files in one directory.

    Each message starts Claude Code on this machine, as whoever runs this process, so it uses that person's login.
    Claude Code decides for itself which actions are safe to take, and never waits to ask for permission.
    """

    def __init__(
            self,
            working_directory: Path,
            instructions: str,
            session_id: str | None = None,
            claude_command: Sequence[str] = ("claude",),
    ) -> None:
        """ Prepares a conversation. Nothing is started until the first message is sent.

        Args:
            working_directory:
                The directory whose files Claude works on.
            instructions:
                Rules for Claude to follow throughout the conversation, on top of its own.
            session_id:
                The `session_id` of an earlier conversation to carry on with, or None to start a new one.
            claude_command:
                The command that starts Claude Code, as a program followed by any arguments it always needs.
        """
        self._working_directory = working_directory
        self._instructions = instructions
        self._session_id = session_id
        self._claude_command = claude_command
        self._process: subprocess.Popen[str] | None = None
        self._was_stopped = False
        # Makes stopping and starting Claude Code take turns, so that a stop can't slip in between deciding to start
        # it and having a process to kill.
        self._process_lock = threading.Lock()

    @property
    def session_id(self) -> str | None:
        """ Identifies the conversation so that it can be carried on later, or None until Claude has started it. """
        return self._session_id

    def send(self, message: str, settings: ClaudeSettings = ClaudeSettings()) -> Iterator[ProgressEvent]:
        """ Sends a message to Claude, and reports what Claude does about it as it happens.

        Only one message can be in progress at a time. It is in progress from this call until the events end,
        although Claude only starts work once the first event is asked for.

        Args:
            message:
                What to say to Claude.
            settings:
                How Claude should work on this message. They can differ between the messages of one conversation.

        Returns:
            What Claude thinks, does and says, in order, ending when Claude has finished. If Claude could not finish,
            the last event is a `FAILURE` that says why, unless that was because of `stop`. Asking for the first
            event raises OSError if Claude Code could not be started, which happens when it isn't installed.
        """
        self._was_stopped = False
        return self._follow_claude(message, settings)

    def _follow_claude(self, message: str, settings: ClaudeSettings) -> Iterator[ProgressEvent]:
        """ Runs Claude Code on a message, and yields its progress until it exits. """
        command = [
            *self._claude_command,
            "--print",
            "--output-format", "stream-json",
            # Claude Code only prints progress as it happens in verbose mode.
            "--verbose",
            "--permission-mode", "auto",
            "--append-system-prompt", self._instructions,
        ]
        if self._session_id:
            command += ["--resume", self._session_id]
        if settings.model:
            command += ["--model", settings.model]
        if settings.effort:
            command += ["--effort", settings.effort]

        with self._process_lock:
            if self._was_stopped:
                return
            process = subprocess.Popen(
                command,
                cwd=self._working_directory,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                # Errors are read from the same stream as progress, so that neither can fill up unread and stall Claude.
                stderr=subprocess.STDOUT,
                encoding="utf-8",
                errors="replace",
            )
            self._process = process

        try:
            # The message goes in through stdin rather than as an argument, so that no quoting rules can mangle it.
            process.stdin.write(message)
            process.stdin.close()

            diagnostic_lines = deque(maxlen=_DIAGNOSTIC_LINE_COUNT)
            has_finished = False
            for line in process.stdout:
                record = _parse_record(line)
                if record is None:
                    diagnostic_lines.append(line.rstrip())
                    continue

                self._session_id = record.get("session_id", self._session_id)
                has_finished = has_finished or record.get("type") == "result"
                yield from _describe_record(record)

            process.wait()
            if not has_finished and not self._was_stopped:
                diagnostics = "\n".join(diagnostic_lines)
                yield ProgressEvent(ProgressKind.FAILURE, f"Claude stopped unexpectedly.\n{diagnostics}".strip())
        finally:
            # Reached early if the caller stops listening, in which case Claude must not be left running unheard.
            with self._process_lock:
                self._process = None
            process.kill()
            process.wait()
            process.stdout.close()

    def stop(self) -> None:
        """ Interrupts the message that is in progress, if there is one. What Claude has already done stays done.

        Commands that Claude started may carry on until they finish by themselves.
        """
        with self._process_lock:
            self._was_stopped = True
            if self._process is not None:
                self._process.kill()


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
    if record.get("type") == "result" and record.get("is_error"):
        yield ProgressEvent(ProgressKind.FAILURE, record.get("result") or "Claude could not finish.")

    if record.get("type") != "assistant":
        return

    # Helpers that Claude delegates to report in the same way. Their steps are worth showing, but their words are
    # addressed to Claude rather than to the person.
    is_from_helper = record.get("parent_tool_use_id") is not None

    for block in record["message"]["content"]:
        if block["type"] == "tool_use":
            yield ProgressEvent(ProgressKind.ACTIVITY, _describe_tool_use(block["name"], block["input"]))
        elif block["type"] == "thinking" and not is_from_helper:
            yield ProgressEvent(ProgressKind.THINKING, block.get("thinking", ""))
        elif block["type"] == "text" and not is_from_helper and block["text"].strip():
            yield ProgressEvent(ProgressKind.REPLY, block["text"].strip())


def _describe_tool_use(tool_name: str, tool_input: dict[str, Any]) -> str:
    """ Describes one use of a tool by Claude, such as "Editing ClockCard.tsx". """
    file_path = tool_input.get("file_path") or tool_input.get("notebook_path")
    # Claude gives paths in the style of whichever shell it used, and a Windows path understands both separators.
    file_name = PureWindowsPath(file_path).name if file_path else None

    if tool_name in ("Edit", "Write", "NotebookEdit") and file_name:
        return f"Editing {file_name}"
    if tool_name == "Read" and file_name:
        return f"Reading {file_name}"
    if tool_name in ("Bash", "PowerShell"):
        command_description = tool_input.get("description") or _shorten(tool_input.get("command", ""))
        return f"Running: {command_description}"
    if tool_name in ("Glob", "Grep"):
        return f"Searching for {tool_input.get('pattern', 'files')}"
    return f"Using {tool_name}"


def _shorten(command: str) -> str:
    first_line = command.strip().split("\n")[0]
    return first_line if len(first_line) <= _MAXIMUM_COMMAND_LENGTH else f"{first_line[:_MAXIMUM_COMMAND_LENGTH]}…"
