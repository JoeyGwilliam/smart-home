import subprocess
from pathlib import Path


def run_git(repository_path: Path, *arguments: str) -> str:
    """ Runs a git command in a repository, and returns what it printed. Raises if the command fails. """
    completed_process = subprocess.run(
        ["git", *arguments], cwd=repository_path, check=True, capture_output=True, encoding="utf-8",
    )
    return completed_process.stdout


def create_repository(repository_path: Path) -> None:
    """ Creates a git repository on the branch `main` with one commit, "first commit" by "Test Author", which adds
    `index.html` containing "<h1>Home</h1>". """
    repository_path.mkdir()
    run_git(repository_path, "init", "--initial-branch=main")
    run_git(repository_path, "config", "user.name", "Test Author")
    run_git(repository_path, "config", "user.email", "author@example.com")
    run_git(repository_path, "config", "commit.gpgsign", "false")
    # Stops Windows from rewriting line endings, which would make an unchanged file look changed.
    run_git(repository_path, "config", "core.autocrlf", "false")
    (repository_path / "index.html").write_text("<h1>Home</h1>", encoding="utf-8")
    run_git(repository_path, "add", "--all")
    run_git(repository_path, "commit", "--message", "first commit")
