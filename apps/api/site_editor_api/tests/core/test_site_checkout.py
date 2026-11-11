import sys
from pathlib import Path

import pytest

from site_editor_api.core.site_checkout import SiteCheckout, SiteCheckoutError
from tests.git_repository import create_repository, run_git


def test_lists_no_changed_files_when_nothing_has_changed(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    checkout = SiteCheckout(tmp_path / "site")

    changed_files = checkout.list_changed_files()

    assert changed_files == []


def test_lists_edited_and_new_files_when_both_exist(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    (tmp_path / "site" / "index.html").write_text("<h1>Farm</h1>", encoding="utf-8")
    (tmp_path / "site" / "pages").mkdir()
    (tmp_path / "site" / "pages" / "new page.html").write_text("<h1>New</h1>", encoding="utf-8")
    checkout = SiteCheckout(tmp_path / "site")

    changed_files = checkout.list_changed_files()

    assert sorted(changed_files) == ["index.html", "pages/new page.html"]


def test_lists_only_new_path_when_file_is_renamed(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    run_git(tmp_path / "site", "mv", "index.html", "home.html")
    checkout = SiteCheckout(tmp_path / "site")

    changed_files = checkout.list_changed_files()

    assert changed_files == ["home.html"]


def test_restores_edited_files_and_deletes_new_ones_when_discarding(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    (tmp_path / "site" / "index.html").write_text("<h1>Farm</h1>", encoding="utf-8")
    (tmp_path / "site" / "new.html").write_text("<h1>New</h1>", encoding="utf-8")
    checkout = SiteCheckout(tmp_path / "site")

    checkout.discard_changes()

    assert (tmp_path / "site" / "index.html").read_text(encoding="utf-8") == "<h1>Home</h1>"
    assert not (tmp_path / "site" / "new.html").exists()


def test_returns_new_commit_and_leaves_nothing_changed_when_committing(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    (tmp_path / "site" / "index.html").write_text("<h1>Farm</h1>", encoding="utf-8")
    (tmp_path / "site" / "new.html").write_text("<h1>New</h1>", encoding="utf-8")
    checkout = SiteCheckout(tmp_path / "site")

    commit = checkout.commit_changes("rename the home page")

    assert commit.subject == "rename the home page"
    assert commit.author == "Test Author"
    assert commit.hash == run_git(tmp_path / "site", "rev-parse", "HEAD").strip()
    assert checkout.list_changed_files() == []


def test_raises_site_checkout_error_when_committing_with_nothing_changed(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    checkout = SiteCheckout(tmp_path / "site")

    with pytest.raises(SiteCheckoutError, match="git commit"):
        checkout.commit_changes("rename the home page")


def test_sends_commits_to_origin_when_pushing(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    run_git(tmp_path, "init", "--bare", "origin.git")
    run_git(tmp_path / "site", "remote", "add", "origin", str(tmp_path / "origin.git"))
    checkout = SiteCheckout(tmp_path / "site")

    checkout.push_commits()

    assert run_git(tmp_path / "origin.git", "log", "--format=%s", "main").strip() == "first commit"


def test_raises_site_checkout_error_when_pushing_without_origin(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    checkout = SiteCheckout(tmp_path / "site")

    with pytest.raises(SiteCheckoutError, match="git push"):
        checkout.push_commits()


def test_lists_commits_newest_first_when_there_are_several(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    (tmp_path / "site" / "index.html").write_text("<h1>Farm</h1>", encoding="utf-8")
    checkout = SiteCheckout(tmp_path / "site")
    checkout.commit_changes("rename the home page")

    commits = checkout.list_commits(limit=10)

    assert [commit.subject for commit in commits] == ["rename the home page", "first commit"]
    assert commits[0].committed_at.utcoffset() is not None


def test_lists_only_newest_commits_when_there_are_more_than_limit(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    (tmp_path / "site" / "index.html").write_text("<h1>Farm</h1>", encoding="utf-8")
    checkout = SiteCheckout(tmp_path / "site")
    checkout.commit_changes("rename the home page")

    commits = checkout.list_commits(limit=1)

    assert [commit.subject for commit in commits] == ["rename the home page"]


def test_runs_rebuild_command_in_repository_when_rebuilding(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    record_path = tmp_path / "rebuilt_in.txt"
    record_working_directory = f"import os; open({str(record_path)!r}, 'w').write(os.getcwd())"
    checkout = SiteCheckout(tmp_path / "site", rebuild_command=(sys.executable, "-c", record_working_directory))

    checkout.rebuild_site()

    assert record_path.read_text() == str(tmp_path / "site")


def test_raises_site_checkout_error_with_output_when_rebuild_fails(tmp_path: Path) -> None:
    create_repository(tmp_path / "site")
    fail_to_build = "import sys; print('TS2322: wrong type'); sys.exit(1)"
    checkout = SiteCheckout(tmp_path / "site", rebuild_command=(sys.executable, "-c", fail_to_build))

    with pytest.raises(SiteCheckoutError, match="TS2322: wrong type"):
        checkout.rebuild_site()
