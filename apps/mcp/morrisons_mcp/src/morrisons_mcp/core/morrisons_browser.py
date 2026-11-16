import asyncio
import json
import logging
import os
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    Route,
    async_playwright,
)
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from .login_window import watch_person_log_in
from .morrisons_error import MorrisonsError
from .ordering_guard import SHOP_HOST, is_request_allowed
from .shop_settings import ShopSettings

logger = logging.getLogger(__name__)

SHOP_URL = f"https://{SHOP_HOST}"

# The button in the header of every page that shows where the shop delivers to.
DELIVERY_BUTTON = '[data-test="delivery-destination-selector-button"]'

# Things that make a page slower to load and that nothing here reads.
_UNNEEDED_RESOURCE_TYPES = frozenset({"image", "media", "font"})

_SECONDS_TO_WAIT_FOR_OPTIONAL_POPUP = 2

# How long Morrisons' login website may take to send a browser back to the shop, signed in, once it has nothing left to
# ask the person.
_SECONDS_TO_FINISH_LOGGING_IN = 20

# Where browsers are usually installed on Windows, for the installed browsers that `ShopSettings.browser_channel` can
# name. Program Files is tried both with and without "(x86)".
_INSTALLED_BROWSER_PATHS = {
    "msedge": ("Microsoft", "Edge", "Application", "msedge.exe"),
    "chrome": ("Google", "Chrome", "Application", "chrome.exe"),
}


class MorrisonsBrowser:
    """ A browser that stays open between uses so that the trolley survives from one tool call to the next. It is
    logged in to a Morrisons account if a person has used `let_person_log_in`, and is otherwise a guest with nothing but
    a delivery location.

    The browser can only send the requests that `is_request_allowed` accepts, so nothing done with it can place an
    order. What it remembers, the trolley included, is saved to `ShopSettings.state_directory`, so it also survives this
    program being restarted.

    Only one thing should use the page at a time. Nothing here enforces that, so callers must take turns.
    """

    def __init__(self, settings: ShopSettings) -> None:
        """ Prepares a browser. Nothing is started until `open_page` is first called.

        Args:
            settings:
                Where to deliver to, and where to keep what the browser remembers.
        """
        self._settings = settings
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    @property
    def _state_file(self) -> Path:
        return self._settings.state_directory / "browser_state.json"

    @property
    def _login_profile_directory(self) -> Path:
        return self._settings.state_directory / "login_profile"

    async def open_page(self) -> Page:
        """ Gives the page to work on, starting the browser and choosing the delivery location if that hasn't been done
        yet. The page is left wherever it last was.

        Returns:
            The one page of the browser. It is the same page every time.

        Raises:
            MorrisonsError: If the delivery location can't be chosen, because the website doesn't look as expected.
        """
        if self._page is not None and self._page.is_closed():
            # The browser window was closed or crashed, so start again; the trolley is kept by the website.
            await self.close()
        if self._page is None:
            await self._start()
            await self._choose_delivery_location(self._page)
        return self._page

    async def save_state(self) -> None:
        """ Saves what the browser remembers, so that it is still there after a restart. Does nothing if the browser
        hasn't been started.
        """
        if self._context is not None:
            self._settings.state_directory.mkdir(parents=True, exist_ok=True)
            await self._context.storage_state(path=self._state_file)

    async def close(self) -> None:
        """ Saves what the browser remembers and shuts it down. Does nothing if it hasn't been started. It can be
        started again by calling `open_page`.
        """
        if self._browser is None:
            return
        await self.save_state()
        await self._browser.close()
        await self._playwright.stop()
        self._playwright = self._browser = self._context = self._page = None

    async def let_person_log_in(self, time_limit_seconds: float) -> None:
        """ Opens a browser window on this machine's screen at the shop's login page, for a person to log in to their
        Morrisons account, and keeps the login for later uses of this browser. Returns once the person closes the
        window, or the time limit is up, whichever is first.

        The window is an ordinary browser, which nothing automates while the person uses it, because the login page's
        check for robots refuses a browser that is being automated (see `watch_person_log_in`). So, unlike this
        browser, it has no guard: it is the person's to use as they would their own. It has a profile of its own, kept
        in the state directory, so it shares nothing with any other browser on the machine.

        Args:
            time_limit_seconds:
                The longest to wait for the person, after which the window is closed for them.

        Raises:
            MorrisonsError: If the login couldn't be copied from the window.
        """
        # The login replaces what this browser remembers, so it must not be open and save over it afterwards.
        await self.close()

        async with async_playwright() as playwright:
            browser_executable = _find_browser_executable(playwright, self._settings.browser_channel)
        cookies = await watch_person_log_in(
            browser_executable, self._login_profile_directory, f"{SHOP_URL}/login", time_limit_seconds,
        )

        # What the shop's website stored for itself before the login is kept as it was, as it holds the delivery
        # location rather than anything about the login.
        remembered_state = json.loads(self._state_file.read_text(encoding="utf-8")) if self._state_file.exists() else {}
        login_state = {"cookies": cookies, "origins": remembered_state.get("origins", [])}
        self._state_file.write_text(json.dumps(login_state), encoding="utf-8")

    async def finish_unfinished_login(self) -> None:
        """ Lets Morrisons finish a login that a person left part of the way through in `let_person_log_in`. Only for
        when the shop isn't logged in, as it starts the login again.

        After the password, Morrisons' login website may ask more, such as whether to set up 2-step verification, and
        only signs the shop in once it has sent the person back there. If the person closed the window first, visiting
        the shop's login page again sends this browser straight back to the shop, signed in, unless there is still a
        question for the person to answer, in which case it stays unfinished. Nothing here answers for them.
        """
        page = await self.open_page()
        await page.goto(f"{SHOP_URL}/login", wait_until="domcontentloaded")
        try:
            await page.wait_for_url(_is_back_at_shop, timeout=_SECONDS_TO_FINISH_LOGGING_IN * 1000)
            await page.wait_for_load_state("load")
        except PlaywrightTimeoutError:
            # Morrisons is waiting for the person, which `MorrisonsShop.is_logged_in` shows. Nothing here answers for
            # them.
            pass
        await self.save_state()

    async def log_out(self) -> None:
        """ Forgets everything this browser remembers: the login, the delivery location, which is chosen again when
        next needed, and, for a guest, the trolley. A logged-in account's trolley stays with the account. The login
        window forgets the person too.
        """
        await self.close()
        self._state_file.unlink(missing_ok=True)
        shutil.rmtree(self._login_profile_directory, ignore_errors=True)

    async def _start(self) -> None:
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(channel=self._settings.browser_channel, headless=True)
        remembered_state = self._state_file if self._state_file.exists() else None
        self._context = await self._browser.new_context(
            locale="en-GB",
            viewport={"width": 1400, "height": 1000},
            storage_state=remembered_state,
        )
        await self._context.route("**/*", self._allow_or_block)
        self._page = await self._context.new_page()
        self._page.set_default_timeout(15_000)

    @staticmethod
    async def _allow_or_block(route: Route) -> None:
        request = route.request
        if request.resource_type in _UNNEEDED_RESOURCE_TYPES:
            await route.abort()
        elif is_request_allowed(request.method, request.url, request.post_data):
            await route.continue_()
        else:
            logger.warning("Blocked %s %s, as it could place an order.", request.method, request.url)
            await route.abort("blockedbyclient")

    async def _choose_delivery_location(self, page: Page) -> None:
        """ Makes the shop deliver to the configured address, unless it already does from an earlier run. """
        await page.goto(SHOP_URL, wait_until="domcontentloaded")
        await self._dismiss_cookie_banner_and_popup(page)

        delivery_button = page.locator(DELIVERY_BUTTON)
        await delivery_button.wait_for()
        if _without_spaces(await delivery_button.inner_text()) == _without_spaces(self._settings.postcode):
            return

        await delivery_button.click()
        address_search = page.get_by_placeholder("Search for your address")
        await address_search.click()
        # Typing slowly, as the suggestions are asked for as each letter is typed.
        await address_search.press_sequentially(self._settings.postcode, delay=60)

        address_pattern = re.compile(rf"^\s*{re.escape(self._settings.address_line)}\b", re.IGNORECASE)
        address_suggestion = page.locator('[data-test="search-suggestions-item"]', has_text=address_pattern).first
        try:
            await address_suggestion.click()
        except PlaywrightTimeoutError as error:
            raise MorrisonsError(
                f"Morrisons doesn't list '{self._settings.address_line}' under the postcode "
                f"'{self._settings.postcode}'. Check MORRISONS_POSTCODE and MORRISONS_ADDRESS_LINE."
            ) from error

        # Confirming before the page has switched to the chosen address would confirm the shop's default one instead.
        await page.get_by_text(re.compile(rf"Deliver to:.*{re.escape(self._settings.address_line)}", re.I)).wait_for()
        await page.get_by_role("button", name="Confirm location").click()
        # Home delivery is already chosen, so confirming accepts it.
        await page.get_by_role("button", name="Confirm", exact=True).click()
        postcode_start = re.compile(re.escape(self._settings.postcode[:3]), re.IGNORECASE)
        await page.locator(DELIVERY_BUTTON, has_text=postcode_start).wait_for()
        await self.save_state()

    @staticmethod
    async def _dismiss_cookie_banner_and_popup(page: Page) -> None:
        """ Refuses optional cookies and closes the promotional pop-up, each only if the website shows it. """
        for dismissal in (
                page.get_by_role("button", name="Reject All"),
                page.locator('[data-test="popup-banner-close-button"]'),
        ):
            try:
                await dismissal.click(timeout=_SECONDS_TO_WAIT_FOR_OPTIONAL_POPUP * 1000)
            except PlaywrightTimeoutError:
                # Not shown, which is normal: the website only shows them to a browser that hasn't seen them before.
                pass


def _without_spaces(text: str) -> str:
    return re.sub(r"\s+", "", text).upper()


def _find_browser_executable(playwright: Playwright, browser_channel: str | None) -> str:
    """ Finds the program of the browser that `browser_channel` names, or of Playwright's own when it names none.

    Raises:
        MorrisonsError: If the browser isn't installed where it usually is.
    """
    if browser_channel is None:
        return playwright.chromium.executable_path

    program_files_directories = [os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles")]
    candidate_paths = [
        Path(directory, *_INSTALLED_BROWSER_PATHS.get(browser_channel, ()))
        for directory in program_files_directories if directory
    ]
    for path in candidate_paths:
        if browser_channel in _INSTALLED_BROWSER_PATHS and path.is_file():
            return str(path)
    raise MorrisonsError(f"Couldn't find the browser '{browser_channel}' to log in with. Check MORRISONS_BROWSER_CHANNEL.")


def _is_back_at_shop(url: str) -> bool:
    parts = urlsplit(url)
    return parts.hostname == SHOP_HOST and not parts.path.startswith("/login")
