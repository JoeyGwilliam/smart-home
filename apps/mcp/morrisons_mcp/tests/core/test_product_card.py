from decimal import Decimal

from morrisons_mcp.core.product import Product
from morrisons_mcp.core.product_card import (
    RawCard,
    parse_price,
    parse_product,
    parse_trolley_line,
)
from morrisons_mcp.core.trolley import TrolleyLine


def test_reads_every_field_when_parsing_a_search_result() -> None:
    card = RawCard(
        id="dc0452da-491a-48ab-8e84-75d9293e7de0",
        name="Cravendale Semi Skimmed Milk 2L",
        price_text="£2.65",
        price_before_offer_text="£3.10",
        size="2L",
        price_per_unit_text="(£1.33/litre)",
        offer_text="Buy 2 for £4",
        offer_path="/offers/buy-2-for-4/1010745997",
        rating_text="Rating, 4.8 out of 5 from 137 reviews.",
        quantity_in_trolley=1,
        has_quantity_buttons=True,
    )

    product = parse_product(card)

    assert product == Product(
        id="dc0452da-491a-48ab-8e84-75d9293e7de0",
        name="Cravendale Semi Skimmed Milk 2L",
        price=Decimal("2.65"),
        size="2L",
        price_per_unit="£1.33/litre",
        offer="Buy 2 for £4",
        offer_path="/offers/buy-2-for-4/1010745997",
        price_before_offer=Decimal("3.10"),
        rating=4.8,
        review_count=137,
        is_available=True,
        quantity_in_trolley=1,
    )


def test_leaves_optional_fields_empty_when_a_search_result_has_nothing_extra() -> None:
    card = RawCard(id="a", name="Bananas", price_text="£1.00", has_quantity_buttons=True)

    product = parse_product(card)

    assert (product.size, product.offer, product.offer_path, product.price_before_offer, product.rating) == (
        None, None, None, None, None,
    )


def test_finds_no_rating_when_a_product_has_no_reviews() -> None:
    card = RawCard(id="a", name="Bananas", rating_text="Rating, 0 out of 5 from 0 reviews.")

    product = parse_product(card)

    assert (product.rating, product.review_count) == (None, 0)


def test_is_unavailable_when_a_search_result_has_no_buttons_to_add_it() -> None:
    card = RawCard(id="a", name="Bananas", price_text="£1.00", has_quantity_buttons=False)

    product = parse_product(card)

    assert not product.is_available


def test_has_no_price_when_a_search_result_shows_none() -> None:
    card = RawCard(id="a", name="Bananas")

    product = parse_product(card)

    assert product.price is None


def test_keeps_only_the_offer_wording_when_the_offer_text_has_a_second_line() -> None:
    card = RawCard(id="a", name="Milk", offer_text="Now £1.40, Was £2\n(£1.40/litre)")

    product = parse_product(card)

    assert product.offer == "Now £1.40, Was £2"


def test_keeps_the_price_per_unit_in_pence_when_it_is_under_a_pound() -> None:
    card = RawCard(id="a", name="Milk", price_per_unit_text="(77.0p/litre)")

    product = parse_product(card)

    assert product.price_per_unit == "77.0p/litre"


def test_reads_the_line_total_and_progress_when_parsing_a_trolley_line() -> None:
    card = RawCard(
        id="a",
        name="Cravendale Semi Skimmed Milk 2L",
        price_text="£2.65",
        quantity_in_trolley=1,
        offer_text="Buy 2 for £4",
        offer_progress="1/2",
    )

    line = parse_trolley_line(card)

    assert line == TrolleyLine(
        product_id="a",
        name="Cravendale Semi Skimmed Milk 2L",
        quantity=1,
        price=Decimal("2.65"),
        price_before_offers=None,
        offer="Buy 2 for £4",
        offer_progress="1/2",
    )


def test_reads_the_price_before_offers_when_a_trolley_line_has_savings() -> None:
    card = RawCard(id="a", name="Milk", price_text="£4.00", price_before_offer_text="£5.30", quantity_in_trolley=2)

    line = parse_trolley_line(card)

    assert line.price_before_offers == Decimal("5.30")


def test_finds_the_amount_when_text_has_other_words_around_it() -> None:
    assert parse_price("Minimum: £25.00") == Decimal("25.00")


def test_finds_a_positive_amount_when_text_is_a_negative_saving() -> None:
    assert parse_price("-£1.30") == Decimal("1.30")


def test_ignores_thousands_separators_when_finding_an_amount() -> None:
    assert parse_price("£1,250.50") == Decimal("1250.50")


def test_finds_no_amount_when_text_has_none() -> None:
    assert parse_price("Free") is None


def test_finds_no_amount_when_there_is_no_text() -> None:
    assert parse_price(None) is None
