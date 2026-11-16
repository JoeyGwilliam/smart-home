import functools
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from playwright.async_api import Error as PlaywrightError

from ..core.morrisons_error import MorrisonsError
from ..core.morrisons_shop import MorrisonsShop
from ..core.product import Product
from ..core.trolley import Trolley

_READS_ONLY = ToolAnnotations(readOnlyHint=True)

_INSTRUCTIONS = """
These tools shop at the Morrisons online grocery shop for a household in Bristol, by filling a trolley.

You can search for products, look at offers, and add things to or take things out of the trolley. You cannot check
out, book a delivery slot or pay, and nothing here ever places an order: a person reviews the trolley and orders it
themselves.

How to shop well:
- Search for each thing with the plain words a shopper would use, such as "semi skimmed milk" or "lamb mince". Look at
  several results before choosing, and compare `price_per_unit` rather than `price` when pack sizes differ.
- Prefer products that have an `offer`, when they are what was asked for. Say so when an offer influenced your choice.
- A multi-buy offer such as "Buy 2 for £4" only saves money if enough are bought. After adding, check the trolley line's
  `offer_progress`: "1/2" means one more is needed to earn it.
- A product's `id` can only be added to the trolley after it has been found by a search or offer list, and only for a
  while, so add soon after searching.
- Use `view_trolley` to check your work. The trolley has a minimum spend; `shortfall_to_minimum_spend` says how far
  short it is.
""".strip()


def _tell_agent_about_failures[**Parameters, Result](
        tool: Callable[Parameters, Awaitable[Result]],
) -> Callable[Parameters, Awaitable[Result]]:
    """ Makes a tool report the failures an agent can act on, with their messages, rather than as a crash whose cause is
    hidden from it. This is the one place that handles them, so the tools needn't.
    """

    @functools.wraps(tool)
    async def run_tool(*args: Parameters.args, **kwargs: Parameters.kwargs) -> Result:
        try:
            return await tool(*args, **kwargs)
        except MorrisonsError as error:
            raise ToolError(str(error)) from error
        except PlaywrightError as error:
            # Timeouts and the like mean the website was slow or looked different, which trying again may get past.
            reason = error.message.splitlines()[0]
            raise ToolError(f"Morrisons' website didn't respond as expected. Try again. ({reason})") from error

    return run_tool


def create_server(shop: MorrisonsShop, lifespan: Callable[[MCPServer], AbstractAsyncContextManager[None]]) -> MCPServer:
    """ Makes an MCP server that lets an agent shop at Morrisons through `shop`.

    It offers exactly these tools: `search_products`, `list_products_in_offer`, `list_featured_offers`,
    `add_to_trolley`, `remove_from_trolley`, `view_trolley` and `empty_trolley`. None of them can order anything.

    Args:
        shop:
            The shop to act on.
        lifespan:
            Runs while the server is running, so that the shop's browser can be shut down when it stops.

    Returns:
        The server, ready to run.
    """
    server = MCPServer("morrisons", instructions=_INSTRUCTIONS, lifespan=lifespan)

    @server.tool(annotations=_READS_ONLY)
    @_tell_agent_about_failures
    async def search_products(query: str, only_on_offer: bool = False, limit: int = 12) -> list[Product]:
        """ Searches Morrisons for products to buy, most relevant first. Each result gives its price, size, price per
        unit, any offer on it, its rating, and whether it is in the trolley already.

        Args:
            query:
                What to search for, in a shopper's words, such as "semi skimmed milk".
            only_on_offer:
                True to only see products that have an offer on them.
            limit:
                The most products to return.
        """
        return list(await shop.search_products(query, only_on_offer, limit))

    @server.tool(annotations=_READS_ONLY)
    @_tell_agent_about_failures
    async def list_products_in_offer(offer_path: str, limit: int = 24) -> list[Product]:
        """ Lists every product that an offer applies to, such as all the milks in "Buy 2 for £4", so that the
        cheapest or best of them can be chosen.

        Args:
            offer_path:
                The `offer_path` of a product that has the offer.
            limit:
                The most products to return.
        """
        return list(await shop.list_products_in_offer(offer_path, limit))

    @server.tool(annotations=_READS_ONLY)
    @_tell_agent_about_failures
    async def list_featured_offers(limit: int = 24) -> list[Product]:
        """ Lists products from Morrisons' own offers page, which shows what it is promoting right now. Useful for
        noticing a good deal; to find offers on a particular thing, search with `only_on_offer` instead.

        Args:
            limit:
                The most products to return.
        """
        return list(await shop.list_featured_offers(limit))

    @server.tool()
    @_tell_agent_about_failures
    async def add_to_trolley(product_id: str, quantity: int = 1) -> Trolley:
        """ Puts more of a product in the trolley, and returns the trolley as it is afterwards. Nothing is ordered.
        Fails if the shop limits how many of the product can be bought.

        Args:
            product_id:
                The `id` of a product from a recent search or offer list.
            quantity:
                How many more to add.
        """
        return await shop.add_to_trolley(product_id, quantity)

    @server.tool()
    @_tell_agent_about_failures
    async def remove_from_trolley(product_id: str, quantity: int | None = None) -> Trolley:
        """ Takes some or all of a product out of the trolley, and returns the trolley as it is afterwards. Does
        nothing if the product isn't in the trolley.

        Args:
            product_id:
                The `id` of a product, as given by a search or by a line of the trolley.
            quantity:
                How many to take out. Leave out to take out every one of them.
        """
        return await shop.remove_from_trolley(product_id, quantity)

    @server.tool(annotations=_READS_ONLY)
    @_tell_agent_about_failures
    async def view_trolley() -> Trolley:
        """ Shows what is in the trolley: each product with its quantity, price and offer, what the offers save, the
        total, and how far the total is from the minimum spend.
        """
        return await shop.view_trolley()

    @server.tool()
    @_tell_agent_about_failures
    async def empty_trolley() -> Trolley:
        """ Takes everything out of the trolley, for starting a shop afresh. Returns the empty trolley. """
        return await shop.empty_trolley()

    return server
