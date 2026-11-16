import json
import re
from urllib.parse import urlsplit

SHOP_HOST = "groceries.morrisons.com"

# Words that, as a whole part of a path, mean the request belongs to checking out or paying. Nothing this server does
# needs any of them, so it never lets one through, whatever the method.
_ORDERING_PATH_PARTS = frozenset({"checkout", "order", "orders", "payment", "payments", "slots", "slot-booking"})

_READ_ONLY_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# The only requests to the shop that use a method other than a read-only one, as (method, path). Each is for the
# trolley, for choosing where to deliver to, for asking for the details of products (which the website does with a
# PUT), or for the website's own analytics. A new kind of request is refused until it is added here on purpose, so that
# a change to the website can never lead to an order being placed by surprise.
_ALLOWED_NON_READ_ONLY_REQUESTS = frozenset({
    ("POST", "/api/cart/v1/carts/active/apply-quantity"),
    ("PUT", "/api/address/v1/addresses/by-search-term"),
    ("POST", "/api/address/v3/address-lookup/by-coordinates"),
    ("POST", "/api/ecomdeliverydestinations/v2/temporary-delivery-destinations"),
    ("POST", "/api/customersessions/v2/sessions/proposition"),
    ("PUT", "/api/customersessions/v2/sessions/active"),
    ("PUT", "/api/webproductpagews/v6/products"),
    ("POST", "/events/v1/events"),
})

# The website asks GraphQL for what to show, using POST. GraphQL would also be how it changes things, so a request to it
# is only let through when it is shown to be a query.
_GRAPHQL_PATH = "/graphql"
_GRAPHQL_MUTATION_PATTERN = re.compile(r"\bmutation\b", re.IGNORECASE)


def is_request_allowed(method: str, url: str, body: str | None = None) -> bool:
    """ Decides whether the browser may send a request. This is what makes it impossible for this server to place an
    order: the browser is only ever given requests that this function accepts, however it came to make them.

    Requests to any website other than the shop are always allowed, as they can't place an order. Requests to the shop
    are allowed if they only read, or if they are one of a short list of known changes to the trolley and delivery
    location. Anything to do with checking out or paying is refused.

    Args:
        method:
            The HTTP method of the request, in any case, such as "GET" or "post".
        url:
            The full URL of the request.
        body:
            The text sent with the request, or None if nothing was sent. Only needed to tell whether a request to
            GraphQL reads or changes something.

    Returns:
        True if the request may be sent.
    """
    parts = urlsplit(url)
    if parts.hostname != SHOP_HOST:
        return True

    path = parts.path.rstrip("/")
    if _ORDERING_PATH_PARTS.intersection(path.lower().split("/")):
        return False

    method = method.upper()
    if method in _READ_ONLY_METHODS:
        return True
    if (method, path) == ("POST", _GRAPHQL_PATH):
        return _is_graphql_query(body)
    return (method, path) in _ALLOWED_NON_READ_ONLY_REQUESTS


def _is_graphql_query(body: str | None) -> bool:
    """ Whether a GraphQL request consists only of queries, which read, and no mutations, which change. A request that
    can't be understood as that, including one that names an operation without saying what it does, counts as not
    being a query.
    """
    try:
        request = json.loads(body or "")
    except json.JSONDecodeError:
        return False

    operations = request if isinstance(request, list) else [request]
    return all(
        isinstance(operation, dict)
        and isinstance(operation.get("query"), str)
        and not _GRAPHQL_MUTATION_PATTERN.search(operation["query"])
        for operation in operations
    )
