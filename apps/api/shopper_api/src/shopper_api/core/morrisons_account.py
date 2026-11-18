import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from morrisons_mcp.core.morrisons_browser import MorrisonsBrowser
from morrisons_mcp.core.morrisons_shop import MorrisonsShop
from morrisons_mcp.core.purchase_history import PurchaseHistory
from morrisons_mcp.core.shop_settings import ShopSettings
from morrisons_mcp.core.trolley import Trolley

# How long a person has to log in, in the window that opens for them, before it is closed.
_LOGIN_TIME_LIMIT_SECONDS = 10 * 60


@dataclass(frozen=True)
class AccountView:
    """ What the Morrisons trolley holds, and whose it is.

    Attributes:
        is_logged_in:
            Whether the trolley is a Morrisons account's, which its owner can see and order from anywhere. Otherwise it
            is a guest's, which only exists in this machine's browser.
        trolley:
            What the trolley holds.
    """

    is_logged_in: bool
    trolley: Trolley


class MorrisonsAccount:
    """ The Morrisons trolley that the home shops with, and the login it belongs to, if a person has logged in. It is
    the same trolley that Claude fills through the Morrisons MCP server, as both use the browser state that
    `ShopSettings.state_directory` keeps.

    Each method opens its own browser and closes it again before returning, so that it never holds on to the trolley
    while Claude is using it. That makes each take several seconds. Only one may run at a time, and not while Claude is
    shopping.
    """

    def __init__(self, settings: ShopSettings) -> None:
        """ Prepares the account. Nothing is opened until a method is called.

        Args:
            settings:
                Where to deliver to, and where the browser keeps the trolley and the login.
        """
        self._settings = settings

    def empty_trolley(self) -> None:
        """ Takes everything out of the trolley. """
        self._use_shop(lambda shop, browser: shop.empty_trolley())

    def view(self) -> AccountView:
        """ Reads what the trolley holds, and whether it is a logged-in account's.

        Returns:
            The view.
        """
        async def read_account(shop: MorrisonsShop, browser: MorrisonsBrowser) -> AccountView:
            return AccountView(is_logged_in=await shop.is_logged_in(), trolley=await shop.view_trolley())

        return self._use_shop(read_account)

    def read_purchase_history(self, order_count: int) -> PurchaseHistory:
        """ Reads what the account bought in its latest completed orders. Nothing about any order changes.

        Args:
            order_count:
                How many of the latest orders to read, up to `MAXIMUM_ORDER_COUNT`. Zero reads none.

        Returns:
            What was bought in them. It covers fewer orders if the account has fewer, and none for a guest.

        Raises:
            MorrisonsError: If Morrisons doesn't give the orders as expected, because its website has changed.
        """
        return self._use_shop(lambda shop, browser: shop.read_purchase_history(order_count))

    def let_person_log_in(self) -> bool:
        """ Opens a window on this machine's screen at Morrisons' login page, for a person to log in to their account,
        and keeps the login for every shop after. Returns once they close the window, or after ten minutes.

        Returns:
            Whether the trolley is now a logged-in account's.
        """
        async def log_in(shop: MorrisonsShop, browser: MorrisonsBrowser) -> bool:
            await browser.let_person_log_in(_LOGIN_TIME_LIMIT_SECONDS)
            if await shop.is_logged_in():
                return True
            await browser.finish_unfinished_login()
            return await shop.is_logged_in()

        return self._use_shop(log_in)

    def log_out(self) -> None:
        """ Forgets the login, so that later shops are a guest's. A guest's trolley is forgotten with it. """
        self._use_shop(lambda shop, browser: browser.log_out())

    def _use_shop[Result](self, use: Callable[[MorrisonsShop, MorrisonsBrowser], Awaitable[Result]]) -> Result:
        async def use_then_close() -> Result:
            browser = MorrisonsBrowser(self._settings)
            try:
                return await use(MorrisonsShop(browser), browser)
            finally:
                await browser.close()

        return asyncio.run(use_then_close())
