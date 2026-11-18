import os
from pathlib import Path

import pytest

from morrisons_mcp.core.morrisons_browser import MorrisonsBrowser
from morrisons_mcp.core.morrisons_shop import MorrisonsShop
from morrisons_mcp.core.purchase_history import PurchaseHistory
from morrisons_mcp.core.shop_settings import ShopSettings

# These use the real Morrisons website, so they only run when asked to, with `MORRISONS_LIVE_TESTS=1` and the address
# settings in the environment. They are how to find out that the website has changed. They can't order anything.
pytestmark = pytest.mark.skipif(os.environ.get("MORRISONS_LIVE_TESTS") != "1", reason="uses the real website")


@pytest.fixture
async def shop(tmp_path: Path):
    settings = ShopSettings.from_environment()
    browser = MorrisonsBrowser(
        ShopSettings(settings.postcode, settings.address_line, tmp_path, settings.browser_channel)
    )
    yield MorrisonsShop(browser)
    await browser.close()


async def test_finds_priced_products_when_searching_for_milk(shop: MorrisonsShop) -> None:
    products = await shop.search_products("milk", limit=5)

    assert len(products) == 5 and all(product.price for product in products)


async def test_finds_nothing_when_searching_for_nonsense(shop: MorrisonsShop) -> None:
    products = await shop.search_products("zzqxkjw")

    assert products == ()


async def test_trolley_holds_the_product_when_adding_then_is_empty_after_emptying(shop: MorrisonsShop) -> None:
    product = (await shop.search_products("milk", limit=1))[0]

    trolley_with_product = await shop.add_to_trolley(product.id, 2)
    emptied_trolley = await shop.empty_trolley()

    assert [(line.product_id, line.quantity) for line in trolley_with_product.lines] == [(product.id, 2)]
    assert emptied_trolley.lines == ()


async def test_is_not_logged_in_when_nobody_has_logged_in(shop: MorrisonsShop) -> None:
    assert not await shop.is_logged_in()


async def test_has_no_purchase_history_when_nobody_has_logged_in(shop: MorrisonsShop) -> None:
    history = await shop.read_purchase_history(5)

    assert history == PurchaseHistory(order_count=0, purchases=())
