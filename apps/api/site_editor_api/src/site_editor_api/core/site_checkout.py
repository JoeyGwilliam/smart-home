import os
import subprocess
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path

from .commit import Commit

# How many lines from the end of a failed command's output are kept to explain the failure. A failed build prints
# its errors last, after a lot of progress.
_FAILURE_OUTPUT_LINE_COUNT = 40

# Separates the fields of a commit in git's output. Commit subjects can't contain it.
_FIELD_SEPARATOR = "\x1f"


class SiteCheckoutError(Exception):
    """ A git or build command failed. The message names the command and ends with the last of its output. """


class SiteCheckout:
    """ The copy of the repository that the running site is built from: its files, its history, and its containers.

    Attributes:
        repository_path:
            The root directory of the repository.
    """

    def __init__(
            self,
            repository_path: Path,
            rebuild_command: Sequence[str] = ("docker", "compose", "up", "--detach", "--build"),
    ) -> None:
        """ Wraps an existing checkout. Nothing is run until a method is called.

        Args:
            repository_path:
                The root directory of the repository, which holds compose.yaml.
            rebuild_command:
                The command that rebuilds and restarts the site from the checkout's files, run from the repository's
                root. It must leave the old site running if the build fails.
        """
        self.repository_path = repository_path
        self._rebuild_command = rebuild_command

    def list_changed_files(self) -> list[str]:
        """ Lists the files that differ from the last commit, including new and deleted ones.

        Returns:
            The paths of the files, relative to the repository's root, with forward slashes. Empty when nothing has
            changed. Files that git ignores are never included.

        Raises:
            SiteCheckoutError: If git fails.
        """
        # Entries are separated by NUL so that unusual file names arrive unquoted. Each is a two-letter status, a
        # space, and the path.
        entries = self._run_git("status", "--porcelain", "-z", "--untracked-files=all").split("\0")
        changed_files = []
        is_original_path_of_rename = False
        for entry in entries:
            if is_original_path_of_rename:
                # A rename is followed by an entry of its own that holds only the path the file used to have.
                is_original_path_of_rename = False
            elif entry:
                changed_files.append(entry[3:])
                is_original_path_of_rename = entry[0] in "RC"
        return changed_files

    def discard_changes(self) -> None:
        """ Puts every file back to how it was at the last commit, deleting new files. Files that git ignores are
        left alone. The running site is not rebuilt.

        Raises:
            SiteCheckoutError: If git fails.
        """
        self._run_git("reset", "--hard", "HEAD")
        self._run_git("clean", "--force", "-d")

    def commit_changes(self, message: str) -> Commit:
        """ Saves every changed file as one new commit on the current branch.

        Args:
            message:
                The commit's message.

        Returns:
            The new commit.

        Raises:
            SiteCheckoutError: If git fails, which includes there being nothing to commit.
        """
        self._run_git("add", "--all")
        self._run_git("commit", "--message", message)
        return self.list_commits(limit=1)[0]

    def push_commits(self) -> None:
        """ Sends the current branch's commits to the repository's remote, `origin`.

        Raises:
            SiteCheckoutError: If git fails, which includes the remote being unreachable or refusing the commits.
        """
        self._run_git("push", "origin", "HEAD")

    def list_commits(self, limit: int) -> list[Commit]:
        """ Lists the most recent commits of the current branch.

        Args:
            limit:
                The most commits to return. Must be positive.

        Returns:
            The commits, newest first.

        Raises:
            SiteCheckoutError: If git fails, which includes the branch having no commits yet.
        """
        commit_format = _FIELD_SEPARATOR.join(["%H", "%s", "%an", "%cI"])
        log = self._run_git("log", f"--max-count={limit}", f"--format={commit_format}")
        commits = []
        for line in log.splitlines():
            commit_hash, subject, author, committed_at = line.split(_FIELD_SEPARATOR)
            commits.append(Commit(commit_hash, subject, author, datetime.fromisoformat(committed_at)))
        return commits

    def rebuild_site(self) -> None:
        """ Rebuilds the site from the checkout's files as they are now, committed or not, and restarts the parts
        that changed. Returns once the new site is running.

        Raises:
            SiteCheckoutError: If the build fails, in which case the site keeps running as it was.
        """
        self._run(self._rebuild_command)

    def _run_git(self, *arguments: str) -> str:
        return self._run(["git", *arguments])

    def _run(self, command: Sequence[str]) -> str:
        """ Runs a command from the repository's root, and returns what it printed. """
        completed_process = subprocess.run(
            command,
            cwd=self.repository_path,
            # Nobody is there to answer a prompt, such as git asking for a password, so the command must fail instead
            # of waiting for one.
            stdin=subprocess.DEVNULL,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
        )
        if completed_process.returncode != 0:
            # Commands differ in which stream they explain a failure on, so the end of both is kept.
            output_lines = (completed_process.stdout + completed_process.stderr).strip().splitlines()
            output_end = "\n".join(output_lines[-_FAILURE_OUTPUT_LINE_COUNT:])
            raise SiteCheckoutError(f"`{' '.join(command)}` failed:\n{output_end}")
        return completed_process.stdout
