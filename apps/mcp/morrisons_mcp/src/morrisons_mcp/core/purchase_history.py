from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from .morrisons_error import MorrisonsError

# The most completed orders that the website gives in one go, which is as many as its own "My orders" page asks for.
MAXIMUM_ORDER_COUNT = 20

# Ask the website's GraphQL for the account's completed orders, newest first, as its "My orders" page does, and for what
# was in one of them, as its page for an order does. Both only read. Asking for just these fields, rather than copying
# the website's own much longer queries, keeps what can break when the website changes small.
COMPLETED_ORDERS_QUERY = """
query CompletedOrderIds($first: Int!) {
  customer { ordersCompleted(first: $first) { edges { node { orderId } } } }
}
"""
ORDER_LINES_QUERY = """
query OrderLines($orderId: ID!) {
  customer { orderDetails(orderId: $orderId) { orderLines { isSample product { productId description } } } }
}
"""


@dataclass(frozen=True)
class PastPurchase:
    """ A product that was bought in at least one of the orders that a purchase history covers.

    Attributes:
        name:
            The full name of the product, such as "Heinz Baked Beans 4x415g", in the same form as `Product.name`.
        order_count:
            How many of the orders it was in. At least 1.
    """

    name: str
    order_count: int


@dataclass(frozen=True)
class PurchaseHistory:
    """ What a Morrisons account bought in its latest orders, which shows the brands and kinds of product it likes.

    Attributes:
        order_count:
            How many orders it covers. Zero for a guest, or an account that has never ordered.
        purchases:
            Every product that was bought in them, each once, those bought in the most orders first.
    """

    order_count: int
    purchases: tuple[PastPurchase, ...]


def read_order_ids(completed_orders: dict[str, Any]) -> tuple[str, ...]:
    """ Reads the identifiers of orders from what the website answered to `COMPLETED_ORDERS_QUERY`.

    Args:
        completed_orders:
            The website's answer, as JSON.

    Returns:
        The orders' identifiers, newest first.

    Raises:
        MorrisonsError: If the answer isn't in the shape that was asked for, because the website has changed.
    """
    edges = _read_path(completed_orders, ("data", "customer", "ordersCompleted", "edges"))
    return tuple(edge["node"]["orderId"] for edge in edges)


def combine_orders(order_details: Sequence[dict[str, Any]]) -> PurchaseHistory:
    """ Combines what was in each of some orders into one history. Free samples are left out, as nobody chose them.

    Args:
        order_details:
            What the website answered to `ORDER_LINES_QUERY` for each order, as JSON.

    Returns:
        The history of those orders. Products bought in the same number of orders keep the order they were first seen
        in.

    Raises:
        MorrisonsError: If an answer isn't in the shape that was asked for, because the website has changed.
    """
    names_by_product_id: dict[str, str] = {}
    order_counts: Counter[str] = Counter()
    for answer in order_details:
        product_ids_in_order: set[str] = set()
        for line in _read_path(answer, ("data", "customer", "orderDetails", "orderLines")):
            product = line.get("product") or {}
            if line.get("isSample") or not product.get("description"):
                continue
            names_by_product_id.setdefault(product["productId"], product["description"])
            product_ids_in_order.add(product["productId"])
        order_counts.update(product_ids_in_order)

    # `most_common` keeps ties in the order they were first counted.
    purchases = tuple(
        PastPurchase(names_by_product_id[product_id], order_count)
        for product_id, order_count in order_counts.most_common()
    )
    return PurchaseHistory(len(order_details), purchases)


def _read_path(answer: dict[str, Any], path: tuple[str, ...]) -> list[dict[str, Any]]:
    """ Reads the list at `path` in a GraphQL answer. """
    value: Any = answer
    for key in path:
        value = value.get(key) if isinstance(value, dict) else None
    if not isinstance(value, list):
        errors = "; ".join(error.get("message", "") for error in answer.get("errors", []))
        raise MorrisonsError(f"Morrisons didn't give the past orders as expected. The website may have changed. {errors}")
    return value
