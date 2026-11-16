import logging
import re
from pathlib import Path

from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    Route,
    async_playwright,
)
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from .morrisons_error import MorrisonsError
from .ordering_guard import SHOP_HOST, is_request_allowed
from .shop_settings import ShopSettings

logger = logging.getLogger(__name__)

SHOP_URL = f"https://{SHOP_HOST}"

_DELIVERY_BUTTON = '[data-test="delivery-destination-selector-button"]'

# Things that make a page slower to load and that nothing here reads.
_UNNEEDED_RESOURCE_TYPES = frozenset({"image", "media", "font"})

_SECONDS_TO_WAIT_FOR_OPTIONAL_POPUP = 2


class MorrisonsBrowser:
    """ A browser signed in to nothing but a delivery location, that stays open between uses so that the trolley
    survives from one tool call to the next.

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

        delivery_button = page.locator(_DELIVERY_BUTTON)
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
        await page.locator(_DELIVERY_BUTTON, has_text=postcode_start).wait_for()
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
