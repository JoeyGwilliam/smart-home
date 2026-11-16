@echo off
rem Starts the shopper API, which fills the home's Morrisons trolley from the shopping list for the "Shopping list"
rem page, by having Claude shop with the Morrisons MCP server. Nothing it does can place an order.
rem
rem It runs on this machine rather than in a container, because it uses the Claude Code login of whoever runs it, and
rem a browser. Run it as the user who is logged in to Claude Code, from a Task Scheduler task that starts at log-on, so
rem that the window for logging in to Morrisons appears on this machine's screen. It needs uv, claude, and
rem apps\mcp\morrisons_mcp\.env, which says where to deliver to and which browser to use (see that folder's README).
rem
rem It listens only on this machine. The home-web container forwards the page's calls to it (see nginx.conf).

rem %~dp0 is the directory of this file, which is the repository's root. Git ignores .eggs.
set SHOPPER_STATE_DIRECTORY=%~dp0.eggs\shopper
rem The shopping API's port on this machine, from compose.yaml. Change it if SHOPPING_API_BIND_ADDRESS is set in .env.
set SHOPPING_API_URL=http://127.0.0.1:8004

cd /d "%~dp0apps\api\shopper_api"
rem The settings file is named relative to here, with forward slashes, as uv drops the backslashes from a Windows path.
rem Every open shopping list page asks for the status each few seconds, which would bury everything else in an access log.
uv run --no-dev --env-file ../../mcp/morrisons_mcp/.env uvicorn shopper_api.api.create_app:create_app_from_environment --factory --host 127.0.0.1 --port 8006 --no-access-log
