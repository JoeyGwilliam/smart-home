import json

import pytest

from morrisons_mcp.core.ordering_guard import is_request_allowed

SHOP = "https://groceries.morrisons.com"


@pytest.mark.parametrize(
    "path", ["/checkout", "/checkout/", "/checkout/payment", "/api/checkout/v1/orders", "/orders/123", "/Checkout"],
)
def test_refuses_request_when_path_is_about_checking_out(path: str) -> None:
    assert not is_request_allowed("GET", f"{SHOP}{path}")


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_refuses_request_when_it_could_place_an_order_by_any_method(method: str) -> None:
    assert not is_request_allowed(method, f"{SHOP}/api/checkout/v1/place-order")


@pytest.mark.parametrize("method", ["GET", "HEAD", "OPTIONS", "get"])
def test_allows_request_when_it_only_reads(method: str) -> None:
    assert is_request_allowed(method, f"{SHOP}/search?q=milk")


def test_allows_request_when_it_changes_the_trolley() -> None:
    assert is_request_allowed("POST", f"{SHOP}/api/cart/v1/carts/active/apply-quantity?cartProductSorting=CATEGORIES")


def test_refuses_request_when_it_changes_something_not_on_the_list() -> None:
    assert not is_request_allowed("POST", f"{SHOP}/api/cart/v1/carts/active/submit")


def test_refuses_request_when_a_listed_path_is_used_with_another_method() -> None:
    assert not is_request_allowed("DELETE", f"{SHOP}/api/cart/v1/carts/active/apply-quantity")


def test_allows_request_when_it_is_to_another_website() -> None:
    assert is_request_allowed("POST", "https://www.google-analytics.com/g/collect")


def test_allows_request_when_the_shop_is_named_only_as_part_of_another_address() -> None:
    assert is_request_allowed("POST", "https://groceries.morrisons.com.example.com/api/anything")


def test_allows_request_when_it_is_a_graphql_query() -> None:
    body = json.dumps({"operationName": "GetCartPage", "query": "query GetCartPage { cart { id } }"})

    assert is_request_allowed("POST", f"{SHOP}/graphql", body)


def test_allows_request_when_every_operation_in_a_graphql_batch_is_a_query() -> None:
    body = json.dumps([{"query": "query A { a }"}, {"query": "query B { b }"}])

    assert is_request_allowed("POST", f"{SHOP}/graphql", body)


def test_refuses_request_when_it_is_a_graphql_mutation() -> None:
    body = json.dumps({"query": "mutation PlaceOrder { placeOrder { id } }"})

    assert not is_request_allowed("POST", f"{SHOP}/graphql", body)


def test_refuses_request_when_one_operation_in_a_graphql_batch_is_a_mutation() -> None:
    body = json.dumps([{"query": "query A { a }"}, {"query": "Mutation B { b }"}])

    assert not is_request_allowed("POST", f"{SHOP}/graphql", body)


def test_refuses_request_when_a_graphql_operation_gives_only_a_name() -> None:
    body = json.dumps({"operationName": "PlaceOrder"})

    assert not is_request_allowed("POST", f"{SHOP}/graphql", body)


def test_refuses_request_when_a_graphql_body_is_missing() -> None:
    assert not is_request_allowed("POST", f"{SHOP}/graphql", None)


def test_refuses_request_when_a_graphql_body_is_not_json() -> None:
    assert not is_request_allowed("POST", f"{SHOP}/graphql", "query { a }")
