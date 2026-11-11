from pathlib import Path

from site_editor_api.core.claude_session import ClaudeSession
from site_editor_api.core.claude_settings import ClaudeEffort, ClaudeModel, ClaudeSettings
from site_editor_api.core.progress_event import ProgressEvent, ProgressKind
from tests.fake_claude import create_fake_claude, read_fake_claude_calls


def test_yields_reply_when_claude_says_something(tmp_path: Path) -> None:
    records = [
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "The clock is now bigger."}]}},
        {"type": "result", "is_error": False},
    ]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records))

    events = list(session.send("Make the clock bigger"))

    assert events == [ProgressEvent(ProgressKind.REPLY, "The clock is now bigger.")]


def test_yields_thinking_when_claude_thinks(tmp_path: Path) -> None:
    records = [
        {"type": "assistant", "message": {"content": [{"type": "thinking", "thinking": "The clock lives in ClockCard."}]}},
        {"type": "result", "is_error": False},
    ]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records))

    events = list(session.send("Make the clock bigger"))

    assert events == [ProgressEvent(ProgressKind.THINKING, "The clock lives in ClockCard.")]


def test_yields_activity_naming_file_when_claude_edits_file(tmp_path: Path) -> None:
    tool_use = {"type": "tool_use", "name": "Edit", "input": {"file_path": "C:\\site\\src\\ClockCard.tsx"}}
    records = [{"type": "assistant", "message": {"content": [tool_use]}}, {"type": "result", "is_error": False}]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records))

    events = list(session.send("Make the clock bigger"))

    assert events == [ProgressEvent(ProgressKind.ACTIVITY, "Editing ClockCard.tsx")]


def test_yields_activity_with_description_when_claude_runs_command(tmp_path: Path) -> None:
    tool_use = {"type": "tool_use", "name": "Bash", "input": {"command": "npm test", "description": "Run the tests"}}
    records = [{"type": "assistant", "message": {"content": [tool_use]}}, {"type": "result", "is_error": False}]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records))

    events = list(session.send("Make the clock bigger"))

    assert events == [ProgressEvent(ProgressKind.ACTIVITY, "Running: Run the tests")]


def test_yields_steps_but_not_words_when_record_comes_from_helper(tmp_path: Path) -> None:
    helper_content = [
        {"type": "text", "text": "I found the clock."},
        {"type": "tool_use", "name": "Read", "input": {"file_path": "src/ClockCard.tsx"}},
    ]
    records = [
        {"type": "assistant", "parent_tool_use_id": "toolu_1", "message": {"content": helper_content}},
        {"type": "result", "is_error": False},
    ]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records))

    events = list(session.send("Make the clock bigger"))

    assert events == [ProgressEvent(ProgressKind.ACTIVITY, "Reading ClockCard.tsx")]


def test_yields_failure_with_reason_when_result_is_error(tmp_path: Path) -> None:
    records = [{"type": "result", "is_error": True, "result": "Usage limit reached."}]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records))

    events = list(session.send("Make the clock bigger"))

    assert events == [ProgressEvent(ProgressKind.FAILURE, "Usage limit reached.")]


def test_yields_failure_with_other_output_when_claude_exits_without_result(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, records=[], other_output=["Error: not logged in"])
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=claude_command)

    events = list(session.send("Make the clock bigger"))

    assert events == [ProgressEvent(ProgressKind.FAILURE, "Claude stopped unexpectedly.\nError: not logged in")]


def test_ends_without_failure_when_stopped(tmp_path: Path) -> None:
    records = [{"type": "assistant", "message": {"content": [{"type": "text", "text": "Starting."}]}}]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records, hangs=True))

    events = []
    for event in session.send("Make the clock bigger"):
        events.append(event)
        session.stop()

    assert events == [ProgressEvent(ProgressKind.REPLY, "Starting.")]


def test_gives_claude_message_instructions_and_directory_when_sending(tmp_path: Path) -> None:
    site_path = tmp_path / "site"
    site_path.mkdir()
    claude_command = create_fake_claude(tmp_path, records=[{"type": "result", "is_error": False}])
    session = ClaudeSession(site_path, "Be brief.", claude_command=claude_command)

    list(session.send("Make the clock bigger"))

    [call] = read_fake_claude_calls(tmp_path)
    assert call["message"] == "Make the clock bigger"
    assert call["working_directory"] == str(site_path)
    instructions_index = call["arguments"].index("--append-system-prompt") + 1
    assert call["arguments"][instructions_index] == "Be brief."


def test_starts_new_conversation_when_sending_first_message(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, records=[{"type": "result", "is_error": False}])
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=claude_command)

    list(session.send("Make the clock bigger"))

    [call] = read_fake_claude_calls(tmp_path)
    assert "--resume" not in call["arguments"]


def test_resumes_conversation_claude_started_when_sending_second_message(tmp_path: Path) -> None:
    records = [{"type": "system", "subtype": "init", "session_id": "abc-123"}, {"type": "result", "is_error": False}]
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=create_fake_claude(tmp_path, records))
    list(session.send("Make the clock bigger"))

    list(session.send("Bigger still"))

    second_call = read_fake_claude_calls(tmp_path)[1]
    resume_index = second_call["arguments"].index("--resume") + 1
    assert second_call["arguments"][resume_index] == "abc-123"


def test_resumes_earlier_conversation_when_created_with_its_session_id(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, records=[{"type": "result", "is_error": False}])
    session = ClaudeSession(tmp_path, "Be brief.", session_id="abc-123", claude_command=claude_command)

    list(session.send("Bigger still"))

    [call] = read_fake_claude_calls(tmp_path)
    resume_index = call["arguments"].index("--resume") + 1
    assert call["arguments"][resume_index] == "abc-123"


def test_has_no_session_id_when_nothing_has_been_sent(tmp_path: Path) -> None:
    session = ClaudeSession(tmp_path, "Be brief.")

    assert session.session_id is None


def test_asks_for_model_and_effort_when_settings_name_them(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, records=[{"type": "result", "is_error": False}])
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=claude_command)

    list(session.send("Make the clock bigger", ClaudeSettings(model=ClaudeModel.OPUS, effort=ClaudeEffort.EXTRA_HIGH)))

    [call] = read_fake_claude_calls(tmp_path)
    assert call["arguments"][call["arguments"].index("--model") + 1] == "opus"
    assert call["arguments"][call["arguments"].index("--effort") + 1] == "xhigh"


def test_leaves_model_and_effort_to_claude_code_when_settings_name_neither(tmp_path: Path) -> None:
    claude_command = create_fake_claude(tmp_path, records=[{"type": "result", "is_error": False}])
    session = ClaudeSession(tmp_path, "Be brief.", claude_command=claude_command)

    list(session.send("Make the clock bigger"))

    [call] = read_fake_claude_calls(tmp_path)
    assert "--model" not in call["arguments"]
    assert "--effort" not in call["arguments"]
