import httpx

from .shopping_failed_error import ShoppingFailedError
from .shopping_list_item import ShoppingListItem

_TIMEOUT_SECONDS = 10


def fetch_shopping_list(shopping_api_url: str) -> tuple[ShoppingListItem, ...]:
    """ Fetches everything that the home's basket adds up to buying, from the shopping API.

    Args:
        shopping_api_url:
            Where the shopping API is, such as "http://localhost:8004".

    Returns:
        The items, in the order that the shopping API gives them. Empty if the basket is.

    Raises:
        ShoppingFailedError: If the shopping API can't be reached, or fails.
    """
    try:
        response = httpx.get(f"{shopping_api_url.rstrip('/')}/basket", timeout=_TIMEOUT_SECONDS)
        response.raise_for_status()
    except httpx.HTTPError as error:
        # Nothing can be bought without the list, so the shop ends, and the person is told why in their own terms.
        raise ShoppingFailedError(f"Couldn't read the shopping list from the shopping basket.\n{error}") from error

    return tuple(
        ShoppingListItem(item["name"], item["quantity"], tuple(item["needed_for"]))
        for item in response.json()["shopping_list"]
    )
