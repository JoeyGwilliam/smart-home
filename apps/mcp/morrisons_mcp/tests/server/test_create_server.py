from contextlib import asynccontextmanager
from decimal import Decimal

import pytest
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from morrisons_mcp.core.morrisons_error import MorrisonsError
from morrisons_mcp.core.trolley import Trolley
from morrisons_mcp.server.create_server import create_server

EMPTY_TROLLEY = Trolley(
    lines=(),
    item_count=0,
    subtotal=Decimal(0),
    savings=Decimal(0),
    total=Decimal(0),
    minimum_spend=Decimal("25.00"),
    shortfall_to_minimum_spend=Decimal("25.00"),
)


class FakeShop:
    def __init__(self, failure: Exception | None = None) -> None:
        self.failure = failure
        self.added: list[tuple[str, int]] = []

    async def add_to_trolley(self, product_id: str, quantity: int) -> Trolley:
        if self.failure:
            raise self.failure
        self.added.append((product_id, quantity))
        return EMPTY_TROLLEY


@asynccontextmanager
async def no_lifespan(_server: MCPServer):
    yield


async def test_offers_only_tools_that_cannot_order_when_listing_tools() -> None:
    server = create_server(FakeShop(), no_lifespan)

    tools = await server.list_tools()

    assert {tool.name for tool in tools} == {
        "search_products",
        "list_products_in_offer",
        "list_featured_offers",
        "add_to_trolley",
        "remove_from_trolley",
        "view_trolley",
        "empty_trolley",
    }


async def test_marks_searching_as_read_only_when_listing_tools() -> None:
    server = create_server(FakeShop(), no_lifespan)

    tools = {tool.name: tool for tool in await server.list_tools()}

    assert tools["search_products"].annotations.read_only_hint is True


async def test_passes_arguments_to_the_shop_when_a_tool_is_called() -> None:
    shop = FakeShop()
    server = create_server(shop, no_lifespan)

    await server.call_tool("add_to_trolley", {"product_id": "abc", "quantity": 3})

    assert shop.added == [("abc", 3)]


async def test_tells_the_agent_the_message_when_the_shop_reports_a_problem() -> None:
    shop = FakeShop(failure=MorrisonsError("Search for it first."))
    server = create_server(shop, no_lifespan)

    with pytest.raises(ToolError, match="Search for it first."):
        await server.call_tool("add_to_trolley", {"product_id": "abc"})
