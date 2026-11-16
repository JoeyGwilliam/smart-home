import asyncio
import re
from decimal import Decimal
from urllib.parse import quote_plus

from playwright.async_api import Locator, Page
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from .morrisons_browser import DELIVERY_BUTTON, SHOP_URL, MorrisonsBrowser
from .morrisons_error import MorrisonsError
from .product import Product
from .product_card import (
    CARD_SELECTOR,
    READ_CARDS_SCRIPT,
    RawCard,
    parse_price,
    parse_product,
    parse_trolley_line,
)
from .trolley import Trolley

_PRODUCT_ID_PATTERN = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_OFFER_PATH_PATTERN = re.compile(r"/offers/[\w-]+/[\w-]+")
_LOG_IN_PATTERN = re.compile(r"^\s*log in\s*$", re.IGNORECASE)

# Results appear as the page is scrolled, so reading them all takes a few scrolls. This stops it for pages that never
# run out.
_MAXIMUM_SCROLLS = 12
_SCROLL_PIXELS = 1600

_RESULTS_TIMEOUT_MILLISECONDS = 12_000

_LAYOUT_SWITCH_ATTEMPTS = 4
_LAYOUT_SWITCH_TIMEOUT_MILLISECONDS = 3_000

# More lines than any trolley will have, so that emptying one can't go on forever if a removal doesn't take.
_MAXIMUM_TROLLEY_LINES = 200


class MorrisonsShop:
    """ Everything that can be done at the Morrisons online grocery shop short of ordering: finding products and offers,
    and filling or emptying a trolley. There is deliberately no way to check out or pay, from here or from the browser
    underneath it.

    Each method drives a real browser page, so each takes a few seconds, and only one runs at a time.
    """

    def __init__(self, browser: MorrisonsBrowser) -> None:
        """ Prepares the shop. The browser is only started when something is first done.

        Args:
            browser:
                The browser to shop with. It keeps the trolley between calls.
        """
        self._browser = browser
        # Only one thing at a time may drive the page, as every action depends on what page it is on.
        self._page_in_use = asyncio.Lock()
        # Where each product was last seen, so that a product found by one search can be added by a later call.
        self._pages_where_products_were_seen: dict[str, str] = {}

    async def search_products(self, query: str, only_on_offer: bool = False, limit: int = 12) -> tuple[Product, ...]:
        """ Searches the shop for products, most relevant first.

        Args:
            query:
                What to search for, as a shopper would type it, such as "semi skimmed milk".
            only_on_offer:
                Whether to leave out everything that has no offer on it.
            limit:
                The most products to return. The shop may have fewer matches than that.

        Returns:
            The matching products, or none if nothing matches.
        """
        url = f"{SHOP_URL}/search?q={quote_plus(query)}" + ("&boolean=onOffer" if only_on_offer else "")
        return await self._list_products_on(url, limit)

    async def list_products_in_offer(self, offer_path: str, limit: int = 24) -> tuple[Product, ...]:
        """ Lists everything that an offer applies to, such as every milk in "Buy 2 for £4".

        Args:
            offer_path:
                Where the offer is, as given by `Product.offer_path`, such as "/offers/buy-2-for-4/1010745997".
            limit:
                The most products to return.

        Returns:
            The products in the offer.

        Raises:
            MorrisonsError: If the path isn't an offer's.
        """
        if not _OFFER_PATH_PATTERN.fullmatch(offer_path):
            raise MorrisonsError(f"'{offer_path}' is not an offer's path. Use the offer_path of a product.")
        return await self._list_products_on(f"{SHOP_URL}{offer_path}", limit)

    async def list_featured_offers(self, limit: int = 24) -> tuple[Product, ...]:
        """ Lists products from the shop's offers page, which is what Morrisons is promoting at the moment.

        Args:
            limit:
                The most products to return.

        Returns:
            Products that have an offer on them.
        """
        return await self._list_products_on(f"{SHOP_URL}/promotions", limit)

    async def add_to_trolley(self, product_id: str, quantity: int = 1) -> Trolley:
        """ Puts more of a product in the trolley. Nothing is ordered.

        Args:
            product_id:
                The `Product.id` of a product from a recent search or offer list.
            quantity:
                How many more to add. At least 1.

        Returns:
            The trolley afterwards.

        Raises:
            MorrisonsError: If the product can't be found again, or the shop won't hold as many as were asked for.
        """
        if quantity < 1:
            raise MorrisonsError("The quantity to add must be at least 1.")
        return await self._change_quantity(product_id, quantity)

    async def remove_from_trolley(self, product_id: str, quantity: int | None = None) -> Trolley:
        """ Takes some or all of a product out of the trolley. Does nothing if the product isn't in it.

        Args:
            product_id:
                The product's id, from `Product.id` or from a line of the trolley.
            quantity:
                How many to take out, or None to take out every one. Taking out more than there are leaves none.

        Returns:
            The trolley afterwards.
        """
        return await self._change_quantity(product_id, None if quantity is None else -quantity)

    async def empty_trolley(self) -> Trolley:
        """ Takes everything out of the trolley.

        Returns:
            The empty trolley.
        """
        async with self._page_in_use:
            page = await self._browser.open_page()
            await self._open_trolley_page(page)
            # Each removal redraws the page, so the first card is taken again until none are left.
            for _ in range(_MAXIMUM_TROLLEY_LINES):
                first_card = page.locator(CARD_SELECTOR).first
                if await first_card.count() == 0:
                    break
                await self._set_quantity(page, first_card, await _read_quantity(first_card), 0)
            await self._browser.save_state()
            return await self._read_trolley(page)

    async def view_trolley(self) -> Trolley:
        """ Reads what is in the trolley, with the savings from offers and what it would cost.

        Returns:
            The trolley.
        """
        async with self._page_in_use:
            return await self._read_trolley(await self._browser.open_page())

    async def is_logged_in(self) -> bool:
        """ Finds out whether the shop is being used with a Morrisons account, rather than as a guest. A person logs in
        with `MorrisonsBrowser.let_person_log_in`.

        Returns:
            True if a person has logged in and the shop still accepts that login.
        """
        async with self._page_in_use:
            page = await self._browser.open_page()
            await page.goto(SHOP_URL, wait_until="domcontentloaded")
            # A guest is offered a button that says just "Log in". The header is drawn after the page loads, so it is
            # waited for by the delivery button that it always has.
            await page.locator(DELIVERY_BUTTON).wait_for()
            log_in_button = page.locator('[data-test="login-dropdown-button"]', has_text=_LOG_IN_PATTERN)
            return await log_in_button.count() == 0

    async def _list_products_on(self, url: str, limit: int) -> tuple[Product, ...]:
        async with self._page_in_use:
            page = await self._browser.open_page()
            await page.goto(url, wait_until="domcontentloaded")
            if not await self._wait_for_products(page):
                return ()

            products: dict[str, Product] = {}
            for _ in range(_MAXIMUM_SCROLLS):
                for raw_card in await self._read_cards(page):
                    products.setdefault(raw_card.id, parse_product(raw_card))
                if len(products) >= limit:
                    break
                scrolled_from = await page.evaluate("window.scrollY")
                await page.mouse.wheel(0, _SCROLL_PIXELS)
                await page.wait_for_timeout(500)
                if await page.evaluate("window.scrollY") == scrolled_from:
                    break

            # The URL after loading is where these products can be found again, as the website may have redirected.
            for product_id in products:
                self._pages_where_products_were_seen[product_id] = page.url
            return tuple(products.values())[:limit]

    async def _change_quantity(self, product_id: str, change: int | None) -> Trolley:
        """ Changes how many of a product are in the trolley by `change`, or takes them all out if it is None. """
        if not _PRODUCT_ID_PATTERN.fullmatch(product_id):
            raise MorrisonsError(f"'{product_id}' is not a product id. Use the id of a product from a search.")

        async with self._page_in_use:
            page = await self._browser.open_page()
            is_removing = change is None or change < 0
            # A product being removed is always in the trolley, whereas one being added is only known from where it
            # was found.
            if is_removing:
                await self._open_trolley_page(page)
            else:
                url = self._pages_where_products_were_seen.get(product_id)
                if url is None:
                    raise MorrisonsError("That product hasn't been seen yet. Search for it first, then add it.")
                await page.goto(url, wait_until="domcontentloaded")
                await self._wait_for_products(page)

            card = page.locator(f'[data-test="fop-wrapper:{product_id}"]').first
            if await card.count() == 0:
                if is_removing:
                    return await self._read_trolley(page)
                raise MorrisonsError("The product is no longer on the page where it was found. Search for it again.")

            quantity_before = await _read_quantity(card)
            wanted_quantity = 0 if change is None else max(0, quantity_before + change)
            await self._set_quantity(page, card, quantity_before, wanted_quantity)
            await self._browser.save_state()

            trolley = await self._read_trolley(page)
            quantity_after = next((line.quantity for line in trolley.lines if line.product_id == product_id), 0)
            if quantity_after != wanted_quantity:
                raise MorrisonsError(
                    f"The shop only allowed {quantity_after} of that product in the trolley, not {wanted_quantity}. "
                    "It limits how many of some products can be bought."
                )
            return trolley

    async def _set_quantity(self, page: Page, card: Locator, quantity_before: int, wanted_quantity: int) -> None:
        if wanted_quantity == quantity_before:
            return

        if quantity_before == 0:
            await self._click_and_wait_for_trolley_update(page, card.locator('[data-test="counter-button"]'))
            quantity_before = 1
        if wanted_quantity != quantity_before:
            quantity_box = card.locator('[data-test="quantity-in-basket"]')
            async with page.expect_response(_is_trolley_update):
                await quantity_box.fill(str(wanted_quantity))
                await quantity_box.press("Enter")

    @staticmethod
    async def _click_and_wait_for_trolley_update(page: Page, button: Locator) -> None:
        async with page.expect_response(_is_trolley_update):
            await button.click()

    async def _open_trolley_page(self, page: Page) -> None:
        """ Goes to the trolley page, in the list layout that shows what each product is. """
        await page.goto(f"{SHOP_URL}/basket", wait_until="domcontentloaded")
        await page.locator('[data-test="basket-page-header"]').wait_for()

        is_empty = await page.get_by_text("Your trolley is empty").count() > 0
        if is_empty:
            return

        visible_title = page.locator('[data-test="fop-title"]:visible')
        visible_tile = page.locator('[data-test^="tile-fop-wrapper:"]:visible')
        await visible_title.or_(visible_tile).first.wait_for()
        # The website remembers the layout from last time, and only the tile layout has a button to change it. A click
        # before the page has finished loading is ignored, so the click is repeated until the layout changes.
        for _ in range(_LAYOUT_SWITCH_ATTEMPTS):
            if await visible_title.count() > 0:
                return
            await page.locator('[data-test="toggle-list-button"]').click()
            try:
                await visible_title.first.wait_for(timeout=_LAYOUT_SWITCH_TIMEOUT_MILLISECONDS)
            except PlaywrightTimeoutError:
                # The click was ignored, so go round again and click again.
                continue
        raise MorrisonsError("The trolley page won't show what is in the trolley. The website may have changed.")

    async def _read_trolley(self, page: Page) -> Trolley:
        await self._open_trolley_page(page)

        minimum_spend = parse_price(await page.locator('[data-test="checkout-threshold"]').first.inner_text())
        minimum_spend = minimum_spend or Decimal(0)
        lines = tuple(parse_trolley_line(card) for card in await self._read_cards(page))
        if not lines:
            return Trolley((), 0, Decimal(0), Decimal(0), Decimal(0), minimum_spend, minimum_spend)

        subtotal_text = await page.locator('[data-test="summary-items"]').inner_text()
        item_count = int(re.search(r"\d+", subtotal_text).group())
        subtotal = parse_price(subtotal_text)
        savings = await _read_optional_amount(page, "summary-savings-amount")
        total = parse_price(await page.locator('[data-test="summary-total-amount"]').inner_text())
        return Trolley(
            lines=lines,
            item_count=item_count,
            subtotal=subtotal,
            savings=savings,
            total=total,
            minimum_spend=minimum_spend,
            shortfall_to_minimum_spend=max(Decimal(0), minimum_spend - total),
        )

    @staticmethod
    async def _wait_for_products(page: Page) -> bool:
        """ Waits for a page of products to show something, and says whether it showed any products. """
        first_card = page.locator(CARD_SELECTOR).first
        no_products_message = page.get_by_text("there are no products")
        try:
            await first_card.or_(no_products_message).first.wait_for(timeout=_RESULTS_TIMEOUT_MILLISECONDS)
        except PlaywrightTimeoutError:
            # Neither appeared, so the page has changed in a way that isn't understood; nothing was found on it.
            return False
        return await first_card.count() > 0

    @staticmethod
    async def _read_cards(page: Page) -> list[RawCard]:
        return [RawCard(**fields) for fields in await page.locator(CARD_SELECTOR).evaluate_all(READ_CARDS_SCRIPT)]


def _is_trolley_update(response) -> bool:
    return response.request.method == "POST" and "/api/cart/v1/carts/active/apply-quantity" in response.url


async def _read_quantity(card: Locator) -> int:
    quantity_box = card.locator('[data-test="quantity-in-basket"]')
    return int(await quantity_box.input_value()) if await quantity_box.count() else 0


async def _read_optional_amount(page: Page, data_test: str) -> Decimal:
    element = page.locator(f'[data-test="{data_test}"]')
    if await element.count() == 0:
        return Decimal(0)
    return parse_price(await element.inner_text()) or Decimal(0)
