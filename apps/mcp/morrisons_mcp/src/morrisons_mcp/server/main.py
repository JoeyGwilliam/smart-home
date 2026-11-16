import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from mcp.server.mcpserver import MCPServer

from ..core.morrisons_browser import MorrisonsBrowser
from ..core.morrisons_shop import MorrisonsShop
from ..core.shop_settings import ShopSettings
from .create_server import create_server


def run() -> None:
    """ Runs the Morrisons MCP server over standard input and output until the agent that started it disconnects.

    Where to deliver to is read from the environment: see `ShopSettings.from_environment`.
    """
    # Standard output carries the conversation with the agent, so anything logged must go to standard error.
    logging.basicConfig(level=logging.INFO)
    browser = MorrisonsBrowser(ShopSettings.from_environment())

    @asynccontextmanager
    async def close_browser_when_stopped(_server: MCPServer) -> AsyncIterator[None]:
        try:
            yield
        finally:
            await browser.close()

    create_server(MorrisonsShop(browser), close_browser_when_stopped).run()
