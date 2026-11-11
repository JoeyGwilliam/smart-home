@echo off
rem Starts the site editor API, which lets the site's "Site editor" page change the site by asking Claude Code.
rem
rem It runs on this machine rather than in a container, because it works on this checkout, rebuilds the containers,
rem and uses the Claude Code and git logins of whoever runs it. Run it as the user who is logged in to both, for
rem example from a Task Scheduler task that starts at log-on. It needs uv, git, docker, claude, and Node (with
rem "npm install" already run in apps\home_web) so that Claude can run the site's checks.
rem
rem It listens only on this machine. The home-web container forwards the page's calls to it (see nginx.conf).

rem %~dp0 is the directory of this file, which is the repository's root.
set SITE_EDITOR_REPOSITORY_PATH=%~dp0.
rem The conversation is kept here between runs. Git ignores .eggs, so it never counts as a change to the site.
set SITE_EDITOR_STATE_PATH=%~dp0.eggs\site_editor\change.json

cd /d "%~dp0apps\api\site_editor_api"
rem Every open editor page asks for the change each second, which would bury everything else in an access log.
uv run --no-dev uvicorn site_editor_api.api.create_app:create_app_from_environment --factory --host 127.0.0.1 --port 8002 --no-access-log
