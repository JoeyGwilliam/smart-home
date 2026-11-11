import json
import os
import threading
from collections.abc import Callable, Iterator, Sequence
from dataclasses import asdict
from pathlib import Path

from .change import Change, ChangeState
from .claude_session import ClaudeSession
from .claude_settings import ClaudeSettings
from .progress_event import ProgressEvent, ProgressKind
from .site_checkout import SiteCheckout, SiteCheckoutError

_INSTRUCTIONS = (
    "You are changing this home's website for someone who asked through the site's own editor page, and who may not "
    "be a programmer. Leave every change uncommitted: never run a git command that changes the repository, and never "
    "run docker. Once you finish, the site is rebuilt from your changes for the person to preview, so before you "
    "finish, run the checks of every app you changed; for apps/home_web those are `npm test` and `npm run build`. "
    "Nobody can answer questions while you work, so if the request is unclear, change nothing and reply with your "
    "question. End with a short summary, in plain English, of what the person will see. Your words are shown exactly "
    "as you write them, so write plain text without Markdown."
)

_COMMIT_MESSAGE_REQUEST = (
    "The person has approved the change. Reply with only a one-line commit message for it, in the style of this "
    "repository's recent commits. Do not use any tools."
)

# How many times Claude gets to work on a message: once to make the change, and once more to fix it if the site can't
# be built from it. A second failure is left for the person to decide about.
_ATTEMPTS_PER_MESSAGE = 2

# The longest commit message that is made from the person's own words, when Claude doesn't provide one.
_MAXIMUM_FALLBACK_SUBJECT_LENGTH = 72

_BUSY_STATES = (ChangeState.WORKING, ChangeState.BUILDING, ChangeState.SAVING)


class ActionNotAllowedError(Exception):
    """ The change is not in a state that allows what was asked. The message says why, for the person to read. """


class SiteEditor:
    """ Makes changes to the site by conversation with Claude, one change at a time.

    A change starts with a message. Claude edits the site's files, and the site is rebuilt from them so that the
    change can be seen running before it is saved. From there the person can refine it with more messages, confirm
    it, which commits and pushes it, or discard it, which puts the site back.

    Messages, confirming and discarding return straight away and do their work in the background; `get_change`
    shows how far it has got. The conversation survives a restart of this process.
    """

    def __init__(self, checkout: SiteCheckout, state_path: Path, claude_command: Sequence[str] = ("claude",)) -> None:
        """ Picks up the change that was in progress when the editor last ran, if there was one.

        Args:
            checkout:
                The repository that the site is built from, which Claude works in.
            state_path:
                Where to keep the conversation between runs. The file is created when first needed; its directory
                must exist.
            claude_command:
                The command that starts Claude Code, as a program followed by any arguments it always needs.
        """
        self._checkout = checkout
        self._state_path = state_path
        self._claude_command = claude_command

        # Guards everything below, which requests read while a background thread changes it.
        self._lock = threading.RLock()
        self._state = ChangeState.IDLE
        self._events: list[ProgressEvent] = []
        self._changed_files: list[str] = []
        self._session = self._start_session(session_id=None)
        # How the person last asked for Claude to work, which also goes for what Claude is asked on their behalf.
        self._claude_settings = ClaudeSettings()
        self._was_stopped = False

        self._load_state()

    def get_change(self) -> Change:
        """ Describes the change as it stands right now.

        Returns:
            A snapshot, which later progress does not alter.
        """
        with self._lock:
            return Change(self._state, tuple(self._events), tuple(self._changed_files))

    def send_message(self, message: str, claude_settings: ClaudeSettings = ClaudeSettings()) -> None:
        """ Passes a message to Claude: a request for a change, or the next part of the conversation about one.

        Claude starts work in the background. If it changes any files, the site is rebuilt to preview them, and the
        change is then `REVIEWING`. Otherwise, or if the preview can't be built, it is `DISCUSSING`.

        Args:
            message:
                What the person wants, in their own words.
            claude_settings:
                How Claude should work on this message, and on fixing or saving the change that comes of it.

        Raises:
            ActionNotAllowedError: If the editor is busy, or if no change is in progress and the repository has
                uncommitted changes from elsewhere, which a change must not be mixed up with.
        """
        with self._lock:
            self._require_not_busy()
            if self._state is ChangeState.IDLE:
                if self._checkout.list_changed_files():
                    raise ActionNotAllowedError(
                        "The site's files have changes that weren't made here. Commit or remove them on the server first."
                    )
                # The last change's conversation stayed on show until now.
                self._events = []

            self._was_stopped = False
            self._events.append(ProgressEvent(ProgressKind.REQUEST, message))
            self._set_state(ChangeState.WORKING)
            # Sent before the lock is released, so that a stop always finds a message to interrupt.
            self._claude_settings = claude_settings
            progress = self._session.send(message, claude_settings)

        self._run_in_background(lambda: self._make_change(progress), state_on_failure=ChangeState.DISCUSSING)

    def stop_claude(self) -> None:
        """ Interrupts Claude's work on the last message. Does nothing unless the change is `WORKING`.

        The files stay as Claude left them, with no preview, so the change becomes `DISCUSSING`.
        """
        with self._lock:
            if self._state is not ChangeState.WORKING:
                return
            self._was_stopped = True
        self._session.stop()

    def confirm_change(self) -> None:
        """ Keeps the change that is being reviewed. In the background, it is committed, with a message that Claude
        writes, and pushed, and the conversation ends.

        Raises:
            ActionNotAllowedError: If the change is not `REVIEWING`.
        """
        with self._lock:
            if self._state is not ChangeState.REVIEWING:
                raise ActionNotAllowedError("There is no previewed change to keep.")
            self._set_state(ChangeState.SAVING)

        self._run_in_background(self._save_change, state_on_failure=ChangeState.REVIEWING)

    def discard_change(self) -> None:
        """ Abandons the change and ends the conversation. Does nothing if no change is in progress.

        If any files were changed, they are put back and the site is rebuilt without them, in the background.

        Raises:
            ActionNotAllowedError: If the editor is busy.
        """
        with self._lock:
            self._require_not_busy()
            if self._state is ChangeState.IDLE:
                return
            if not self._checkout.list_changed_files():
                self._end_conversation("The conversation was ended.")
                return
            self._set_state(ChangeState.BUILDING)

        self._run_in_background(self._remove_change, state_on_failure=ChangeState.DISCUSSING)

    def _make_change(self, progress: Iterator[ProgressEvent]) -> None:
        """ Follows Claude's work on a message, then previews whatever it changed. """
        for attempts_left in reversed(range(_ATTEMPTS_PER_MESSAGE)):
            for event in progress:
                self._record(event.kind, event.text)

            with self._lock:
                self._changed_files = self._checkout.list_changed_files()
                if self._was_stopped:
                    self._record(ProgressKind.ACTIVITY, "Stopped. The files are as Claude left them, with no preview.")
                if self._was_stopped or not self._changed_files:
                    self._set_state(ChangeState.DISCUSSING)
                    return
                self._record(ProgressKind.ACTIVITY, "Building the preview")
                self._set_state(ChangeState.BUILDING)

            try:
                self._checkout.rebuild_site()
            except SiteCheckoutError as error:
                with self._lock:
                    self._record(ProgressKind.FAILURE, f"The preview could not be built.\n{error}")
                    if attempts_left == 0:
                        self._set_state(ChangeState.DISCUSSING)
                        return
                    # Claude can usually fix a change that doesn't build, so it is told about the failure instead of
                    # the person, who would only have to pass the same message on.
                    self._set_state(ChangeState.WORKING)
                    fix_request = f"The site could not be rebuilt from your changes. Fix them.\n\n{error}"
                    progress = self._session.send(fix_request, self._claude_settings)
            else:
                with self._lock:
                    self._record(ProgressKind.ACTIVITY, "The preview is ready. The site now shows the change.")
                    self._set_state(ChangeState.REVIEWING)
                return

    def _save_change(self) -> None:
        """ Commits and pushes the change, and ends the conversation. """
        commit = self._checkout.commit_changes(self._write_commit_message())

        try:
            self._checkout.push_commits()
        except SiteCheckoutError as error:
            # The change is already committed and running, so it counts as kept. Only its copy elsewhere is missing,
            # which the person is told about so they can push it themselves.
            self._record(ProgressKind.FAILURE, f"The change is saved on the server, but could not be pushed.\n{error}")

        self._end_conversation(f"Saved as {commit.hash[:7]}: {commit.subject}")

    def _write_commit_message(self) -> str:
        """ Asks Claude, who made the change, for a commit message. Falls back to the person's first request. """
        progress = self._session.send(_COMMIT_MESSAGE_REQUEST, self._claude_settings)
        replies = [event.text for event in progress if event.kind is ProgressKind.REPLY]
        first_request = next(event.text for event in self._events if event.kind is ProgressKind.REQUEST)
        message = replies[-1] if replies else first_request[:_MAXIMUM_FALLBACK_SUBJECT_LENGTH]
        # Claude sometimes wraps its answer in quotes or backticks, or adds an explanation after it.
        return message.splitlines()[0].strip("`\"' ")

    def _remove_change(self) -> None:
        """ Puts the files and the running site back to the last commit, and ends the conversation. """
        self._checkout.discard_changes()
        self._record(ProgressKind.ACTIVITY, "Putting the site back as it was")
        self._checkout.rebuild_site()
        self._end_conversation("The change was discarded.")

    def _end_conversation(self, closing_activity: str) -> None:
        with self._lock:
            self._record(ProgressKind.ACTIVITY, closing_activity)
            self._session = self._start_session(session_id=None)
            self._changed_files = []
            self._set_state(ChangeState.IDLE)

    def _run_in_background(self, job: Callable[[], None], state_on_failure: ChangeState) -> None:
        def run_job() -> None:
            try:
                job()
            except Exception as error:
                # Nothing is waiting for a background job, so its failure can only be reported in the conversation.
                # Every kind is caught, because a job that died silently would leave the editor busy forever.
                with self._lock:
                    self._record(ProgressKind.FAILURE, f"Something went wrong.\n{error}")
                    self._set_state(state_on_failure)

        # A daemon thread doesn't hold up a shutdown of the process.
        threading.Thread(target=run_job, daemon=True).start()

    def _require_not_busy(self) -> None:
        if self._state in _BUSY_STATES:
            raise ActionNotAllowedError("The site editor is busy. Wait for it to finish.")

    def _record(self, kind: ProgressKind, text: str) -> None:
        with self._lock:
            self._events.append(ProgressEvent(kind, text))
            self._save_state()

    def _set_state(self, state: ChangeState) -> None:
        with self._lock:
            self._state = state
            self._save_state()

    def _start_session(self, session_id: str | None) -> ClaudeSession:
        return ClaudeSession(self._checkout.repository_path, _INSTRUCTIONS, session_id, self._claude_command)

    def _save_state(self) -> None:
        saved_state = {
            "state": self._state,
            "session_id": self._session.session_id,
            "changed_files": self._changed_files,
            "events": [asdict(event) for event in self._events],
        }
        # Written beside the file and then swapped in, so that a crash part of the way through can't leave half a file.
        unfinished_path = self._state_path.with_name(f"{self._state_path.name}.unfinished")
        unfinished_path.write_text(json.dumps(saved_state), encoding="utf-8")
        os.replace(unfinished_path, self._state_path)

    def _load_state(self) -> None:
        if not self._state_path.exists():
            return

        saved_state = json.loads(self._state_path.read_text(encoding="utf-8"))
        self._state = ChangeState(saved_state["state"])
        self._session = self._start_session(saved_state["session_id"])
        self._changed_files = saved_state["changed_files"]
        self._events = [ProgressEvent(ProgressKind(event["kind"]), event["text"]) for event in saved_state["events"]]

        if self._state in _BUSY_STATES:
            # Whatever was running died with the last process. The person decides what to do about it: carry on with
            # another message, or discard.
            self._changed_files = self._checkout.list_changed_files()
            self._record(ProgressKind.FAILURE, "The site editor restarted while it was busy, so the last step may not have finished.")
            self._set_state(ChangeState.DISCUSSING)
