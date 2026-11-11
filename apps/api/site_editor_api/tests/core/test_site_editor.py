import sys
import time
from pathlib import Path

import pytest

from site_editor_api.core.change import Change, ChangeState
from site_editor_api.core.claude_settings import ClaudeEffort, ClaudeModel, ClaudeSettings
from site_editor_api.core.progress_event import ProgressEvent, ProgressKind
from site_editor_api.core.site_checkout import SiteCheckout
from site_editor_api.core.site_editor import ActionNotAllowedError, SiteEditor
from tests.fake_claude import create_fake_claude, read_fake_claude_calls
from tests.git_repository import create_repository, run_git

SUCCEED = (sys.executable, "-c", "pass")
FAIL_WITH_TYPE_ERROR = (sys.executable, "-c", "import sys; print('TS2322: wrong type'); sys.exit(1)")

SESSION_STARTED = {"type": "system", "subtype": "init", "session_id": "abc-123"}
CLAUDE_SAYS_BIGGER_CLOCK = {"type": "assistant", "message": {"content": [{"type": "text", "text": "make the clock bigger"}]}}
FINISHED = {"type": "result", "is_error": False}


def wait_until_not_busy(editor: SiteEditor) -> Change:
    """ Waits for the editor's background work to finish, and returns the change as it then stands. """
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        change = editor.get_change()
        if change.state not in (ChangeState.WORKING, ChangeState.BUILDING, ChangeState.SAVING):
            return change
        time.sleep(0.02)
    raise TimeoutError("The editor stayed busy.")


def test_is_idle_with_no_events_when_new(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json")

    change = editor.get_change()

    assert change == Change(ChangeState.IDLE, events=(), changed_files=())


def test_is_reviewing_changed_files_when_claude_changes_file(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)

    editor.send_message("Make the clock bigger")

    change = wait_until_not_busy(editor)
    assert change.state is ChangeState.REVIEWING
    assert change.changed_files == ("index.html",)


def test_records_request_reply_and_preview_when_claude_changes_file(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)

    editor.send_message("Make the clock bigger")

    assert wait_until_not_busy(editor).events == (
        ProgressEvent(ProgressKind.REQUEST, "Make the clock bigger"),
        ProgressEvent(ProgressKind.REPLY, "make the clock bigger"),
        ProgressEvent(ProgressKind.ACTIVITY, "Building the preview"),
        ProgressEvent(ProgressKind.ACTIVITY, "The preview is ready. The site now shows the change."),
    )


def test_rebuilds_site_when_claude_changes_file(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    record_rebuild = (sys.executable, "-c", f"open({str(tmp_path / 'rebuilt.txt')!r}, 'w')")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", record_rebuild), tmp_path / "state.json", claude_command)

    editor.send_message("Make the clock bigger")

    wait_until_not_busy(editor)
    assert (tmp_path / "rebuilt.txt").exists()


def test_is_discussing_without_rebuilding_when_claude_changes_nothing(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED])
    record_rebuild = (sys.executable, "-c", f"open({str(tmp_path / 'rebuilt.txt')!r}, 'w')")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", record_rebuild), tmp_path / "state.json", claude_command)

    editor.send_message("Which clock?")

    assert wait_until_not_busy(editor).state is ChangeState.DISCUSSING
    assert not (tmp_path / "rebuilt.txt").exists()


def test_asks_claude_to_fix_change_when_preview_cannot_be_built(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", FAIL_WITH_TYPE_ERROR), tmp_path / "state.json", claude_command)

    editor.send_message("Make the clock bigger")

    wait_until_not_busy(editor)
    second_message = read_fake_claude_calls(tmp_path)[1]["message"]
    assert "TS2322: wrong type" in second_message


def test_is_discussing_after_two_attempts_when_preview_keeps_failing_to_build(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", FAIL_WITH_TYPE_ERROR), tmp_path / "state.json", claude_command)

    editor.send_message("Make the clock bigger")

    change = wait_until_not_busy(editor)
    assert change.state is ChangeState.DISCUSSING
    assert len(read_fake_claude_calls(tmp_path)) == 2
    assert change.events[-1].kind is ProgressKind.FAILURE
    assert "TS2322: wrong type" in change.events[-1].text


def test_is_discussing_with_failure_when_claude_cannot_be_started(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command=("no-such-program",))

    editor.send_message("Make the clock bigger")

    change = wait_until_not_busy(editor)
    assert change.state is ChangeState.DISCUSSING
    assert change.events[-1].kind is ProgressKind.FAILURE


def test_raises_action_not_allowed_when_messaging_while_claude_works(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [], hangs=True)
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")

    with pytest.raises(ActionNotAllowedError, match="busy"):
        editor.send_message("And make it pink")

    editor.stop_claude()


def test_raises_action_not_allowed_when_starting_change_with_uncommitted_files(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    (tmp_path / "site" / "index.html").write_text("<h1>Half-finished work</h1>", encoding="utf-8")
    claude_command = create_fake_claude(tmp_path, [FINISHED])
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)

    with pytest.raises(ActionNotAllowedError, match="weren't made here"):
        editor.send_message("Make the clock bigger")

    assert read_fake_claude_calls(tmp_path) == []


def test_is_discussing_without_preview_when_claude_is_stopped(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK], file_edits={"index.html": "<h1>Farm</h1>"}, hangs=True)
    record_rebuild = (sys.executable, "-c", f"open({str(tmp_path / 'rebuilt.txt')!r}, 'w')")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", record_rebuild), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")
    while not editor.get_change().events[1:]:
        time.sleep(0.02)

    editor.stop_claude()

    change = wait_until_not_busy(editor)
    assert change.state is ChangeState.DISCUSSING
    assert change.changed_files == ("index.html",)
    assert not (tmp_path / "rebuilt.txt").exists()


def test_carries_on_same_conversation_when_sending_second_message(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [SESSION_STARTED, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")
    wait_until_not_busy(editor)

    editor.send_message("Bigger still")

    change = wait_until_not_busy(editor)
    second_call = read_fake_claude_calls(tmp_path)[1]
    assert second_call["arguments"][second_call["arguments"].index("--resume") + 1] == "abc-123"
    assert [event.text for event in change.events if event.kind is ProgressKind.REQUEST] == ["Make the clock bigger", "Bigger still"]


def test_commits_change_with_message_from_claude_when_confirming(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")
    wait_until_not_busy(editor)

    editor.confirm_change()

    change = wait_until_not_busy(editor)
    assert change.state is ChangeState.IDLE
    assert change.changed_files == ()
    assert run_git(tmp_path / "site", "log", "--format=%s").splitlines() == ["make the clock bigger", "first commit"]
    assert run_git(tmp_path / "site", "status", "--porcelain") == ""


def test_pushes_commit_to_origin_when_confirming(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    run_git(tmp_path, "init", "--bare", "origin.git")
    run_git(tmp_path / "site", "remote", "add", "origin", str(tmp_path / "origin.git"))
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")
    wait_until_not_busy(editor)

    editor.confirm_change()

    wait_until_not_busy(editor)
    assert run_git(tmp_path / "origin.git", "log", "--format=%s", "main").splitlines() == ["make the clock bigger", "first commit"]


def test_keeps_commit_and_reports_failure_when_push_fails_while_confirming(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")
    wait_until_not_busy(editor)

    editor.confirm_change()

    change = wait_until_not_busy(editor)
    assert change.state is ChangeState.IDLE
    assert run_git(tmp_path / "site", "log", "--format=%s").splitlines() == ["make the clock bigger", "first commit"]
    assert any(event.kind is ProgressKind.FAILURE and "could not be pushed" in event.text for event in change.events)


def test_commits_with_first_request_when_claude_gives_no_commit_message(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")
    wait_until_not_busy(editor)

    editor.confirm_change()

    wait_until_not_busy(editor)
    assert run_git(tmp_path / "site", "log", "--format=%s", "--max-count=1").strip() == "Make the clock bigger"


def test_raises_action_not_allowed_when_confirming_with_nothing_to_review(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json")

    with pytest.raises(ActionNotAllowedError):
        editor.confirm_change()


def test_restores_files_and_rebuilds_site_when_discarding_reviewed_change(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    count_rebuild = (sys.executable, "-c", f"open({str(tmp_path / 'rebuilds.txt')!r}, 'a').write('rebuilt\\n')")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", count_rebuild), tmp_path / "state.json", claude_command)
    editor.send_message("Make the clock bigger")
    wait_until_not_busy(editor)

    editor.discard_change()

    change = wait_until_not_busy(editor)
    assert change.state is ChangeState.IDLE
    assert change.changed_files == ()
    assert (tmp_path / "site" / "index.html").read_text(encoding="utf-8") == "<h1>Home</h1>"
    assert (tmp_path / "rebuilds.txt").read_text().splitlines() == ["rebuilt", "rebuilt"]


def test_is_idle_without_rebuilding_when_discarding_with_no_changed_files(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [CLAUDE_SAYS_BIGGER_CLOCK, FINISHED])
    record_rebuild = (sys.executable, "-c", f"open({str(tmp_path / 'rebuilt.txt')!r}, 'w')")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", record_rebuild), tmp_path / "state.json", claude_command)
    editor.send_message("Which clock?")
    wait_until_not_busy(editor)

    editor.discard_change()

    assert editor.get_change().state is ChangeState.IDLE
    assert not (tmp_path / "rebuilt.txt").exists()


def test_does_nothing_when_discarding_while_idle(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json")

    editor.discard_change()

    assert editor.get_change() == Change(ChangeState.IDLE, events=(), changed_files=())


def test_starts_new_conversation_when_messaging_after_discarding(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [SESSION_STARTED, FINISHED])
    editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    editor.send_message("Which clock?")
    wait_until_not_busy(editor)
    editor.discard_change()

    editor.send_message("Make the weather card pink")

    change = wait_until_not_busy(editor)
    assert "--resume" not in read_fake_claude_calls(tmp_path)[1]["arguments"]
    assert change.events == (ProgressEvent(ProgressKind.REQUEST, "Make the weather card pink"),)


def test_keeps_change_and_conversation_when_editor_is_recreated(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [SESSION_STARTED, FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    first_editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    first_editor.send_message("Make the clock bigger")
    change_before = wait_until_not_busy(first_editor)

    second_editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)

    assert second_editor.get_change() == change_before
    second_editor.send_message("Bigger still")
    wait_until_not_busy(second_editor)
    second_call = read_fake_claude_calls(tmp_path)[1]
    assert second_call["arguments"][second_call["arguments"].index("--resume") + 1] == "abc-123"


def test_is_discussing_with_failure_when_recreated_after_dying_while_busy(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [], hangs=True)
    first_editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)
    first_editor.send_message("Make the clock bigger")

    second_editor = SiteEditor(SiteCheckout(tmp_path / "site", SUCCEED), tmp_path / "state.json", claude_command)

    change = second_editor.get_change()
    assert change.state is ChangeState.DISCUSSING
    assert change.events[-1].kind is ProgressKind.FAILURE
    first_editor.stop_claude()


def test_uses_settings_of_message_when_claude_works_on_it_and_fixes_its_preview(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    claude_command = create_fake_claude(tmp_path, [FINISHED], file_edits={"index.html": "<h1>Farm</h1>"})
    editor = SiteEditor(SiteCheckout(tmp_path / "site", FAIL_WITH_TYPE_ERROR), tmp_path / "state.json", claude_command)

    editor.send_message("Make the clock bigger", ClaudeSettings(model=ClaudeModel.SONNET, effort=ClaudeEffort.LOW))

    wait_until_not_busy(editor)
    first_call, second_call = read_fake_claude_calls(tmp_path)
    for call in (first_call, second_call):
        assert call["arguments"][call["arguments"].index("--model") + 1] == "sonnet"
        assert call["arguments"][call["arguments"].index("--effort") + 1] == "low"
