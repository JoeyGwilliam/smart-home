import asyncio
import json
import subprocess
import time
from pathlib import Path
from typing import Any

import websockets
from websockets.exceptions import WebSocketException

from .morrisons_error import MorrisonsError

# How often the window's cookies are copied while the person uses it. The window may be closed at any moment, and the
# shop's login is in a cookie that the browser deletes as it closes, so the last copy before then is the one kept.
_SECONDS_BETWEEN_COPIES = 2

# How long the browser may take to say where it can be asked for its cookies, once started.
_SECONDS_TO_START = 20

# Only cookies of these sites are copied: those of the shop, and of the website it logs in with.
_COPIED_COOKIE_DOMAIN = "morrisons.com"


async def watch_person_log_in(browser_executable: str, profile_directory: Path, login_url: str, time_limit_seconds: float) -> list[dict[str, Any]]:
    """ Opens an ordinary browser window at a login page for a person to log in, and copies its cookies as they go.
    Returns once they close the window, or the time limit is up, in which case the window is closed for them.

    Nothing automates the window, because login pages that check for robots refuse a browser that is being automated.
    Its cookies are asked for from the browser itself, which no web page can see, and none of its pages are touched.

    Args:
        browser_executable:
            The browser's program, which must be Chromium-based, such as Edge.
        profile_directory:
            Where the window keeps its own profile, which shares nothing with any other browser. It remembers the
            person between logins. Created if it doesn't exist.
        login_url:
            Where the window opens.
        time_limit_seconds:
            The longest to wait for the person.

    Returns:
        The window's cookies for Morrisons' websites as they last were before it closed, in the form that Playwright's
        `storage_state` uses. They include the cookies that only last until the browser closes.

    Raises:
        MorrisonsError: If the window's cookies couldn't be copied.
    """
    profile_directory.mkdir(parents=True, exist_ok=True)
    # The browser writes the port it chose here once it is ready, so an old one must not be mistaken for it.
    active_port_file = profile_directory / "DevToolsActivePort"
    active_port_file.unlink(missing_ok=True)

    window = subprocess.Popen([
        browser_executable,
        f"--user-data-dir={profile_directory}",
        # Lets the browser be asked for its cookies, on a port of its choosing that only this machine can reach.
        "--remote-debugging-port=0",
        "--no-first-run",
        "--no-default-browser-check",
        login_url,
    ])
    try:
        browser_address = await _wait_for_browser_address(active_port_file, window)
        cookies = None
        deadline = time.monotonic() + time_limit_seconds
        # The process is the browser itself, which ends once the person closes its last window.
        while window.poll() is None and time.monotonic() < deadline:
            try:
                cookies = await _copy_cookies(browser_address)
            except (OSError, WebSocketException):
                # The person closed the window while its cookies were being copied. The copy before this one holds
                # everything up to a moment ago, which is the best that can be had.
                break
            await asyncio.sleep(_SECONDS_BETWEEN_COPIES)
    finally:
        if window.poll() is None:
            window.terminate()
        await asyncio.to_thread(window.wait)

    if cookies is None:
        raise MorrisonsError("The login window closed before its login could be copied.")
    return cookies


async def _wait_for_browser_address(active_port_file: Path, window: subprocess.Popen) -> str:
    deadline = time.monotonic() + _SECONDS_TO_START
    while time.monotonic() < deadline and window.poll() is None:
        lines = active_port_file.read_text(encoding="utf-8").splitlines() if active_port_file.exists() else []
        if len(lines) >= 2:
            port, browser_path = lines[0], lines[1]
            return f"ws://127.0.0.1:{port}{browser_path}"
        await asyncio.sleep(0.2)
    raise MorrisonsError("The login window didn't start properly, so its login couldn't be copied. Try again.")


async def _copy_cookies(browser_address: str) -> list[dict[str, Any]]:
    """ Asks the browser for every cookie it holds, and keeps Morrisons' ones, in Playwright's form. """
    async with websockets.connect(browser_address, max_size=None) as connection:
        await connection.send(json.dumps({"id": 1, "method": "Storage.getCookies"}))
        while True:
            message = json.loads(await connection.recv())
            if message.get("id") == 1:
                break
    if "error" in message:
        raise MorrisonsError(f"The login window wouldn't give its cookies: {message['error'].get('message')}")

    return [
        {
            "name": cookie["name"],
            "value": cookie["value"],
            "domain": cookie["domain"],
            "path": cookie["path"],
            # The browser says -1 for a cookie that only lasts until it closes, as Playwright does.
            "expires": -1 if cookie.get("session") else cookie["expires"],
            "httpOnly": cookie["httpOnly"],
            "secure": cookie["secure"],
            # A cookie that doesn't say is treated as "Lax" by browsers.
            "sameSite": cookie.get("sameSite", "Lax"),
        }
        for cookie in message["result"]["cookies"]
        if cookie["domain"].lstrip(".").endswith(_COPIED_COOKIE_DOMAIN)
    ]
