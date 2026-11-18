import pytest

from morrisons_mcp.core.morrisons_error import MorrisonsError
from morrisons_mcp.core.purchase_history import PastPurchase, PurchaseHistory, combine_orders, read_order_ids


def order_with_lines(*lines: dict) -> dict:
    """ What the website answers when asked for what was in an order that had `lines`. """
    return {"data": {"customer": {"orderDetails": {"orderLines": list(lines)}}}}


def line(product_id: str, name: str, is_sample: bool = False) -> dict:
    return {"isSample": is_sample, "product": {"productId": product_id, "description": name}}


def test_reads_order_ids_in_given_order_when_account_has_completed_orders() -> None:
    answer = {"data": {"customer": {"ordersCompleted": {"edges": [
        {"node": {"orderId": "newest"}},
        {"node": {"orderId": "older"}},
    ]}}}}

    order_ids = read_order_ids(answer)

    assert order_ids == ("newest", "older")


def test_raises_morrisons_error_with_website_message_when_answer_has_no_orders() -> None:
    answer = {"errors": [{"message": "Not authorised"}], "data": None}

    with pytest.raises(MorrisonsError, match="Not authorised"):
        read_order_ids(answer)


def test_counts_each_product_once_per_order_most_often_first_when_combining_orders() -> None:
    first_order = order_with_lines(line("beans", "Heinz Baked Beans 4x415g"), line("cheese", "Cathedral City Cheddar 350g"))
    second_order = order_with_lines(line("cheese", "Cathedral City Cheddar 350g"), line("cheese", "Cathedral City Cheddar 350g"))

    history = combine_orders([first_order, second_order])

    assert history == PurchaseHistory(
        order_count=2,
        purchases=(PastPurchase("Cathedral City Cheddar 350g", 2), PastPurchase("Heinz Baked Beans 4x415g", 1)),
    )


def test_leaves_out_free_samples_when_combining_orders() -> None:
    order = order_with_lines(line("beans", "Heinz Baked Beans 4x415g"), line("tea", "Yorkshire Tea 10 Bags", is_sample=True))

    history = combine_orders([order])

    assert history.purchases == (PastPurchase("Heinz Baked Beans 4x415g", 1),)


def test_is_empty_when_combining_no_orders() -> None:
    history = combine_orders([])

    assert history == PurchaseHistory(order_count=0, purchases=())


def test_raises_morrisons_error_when_an_order_answer_has_no_lines() -> None:
    answer = {"data": {"customer": {"orderDetails": None}}}

    with pytest.raises(MorrisonsError):
        combine_orders([answer])
