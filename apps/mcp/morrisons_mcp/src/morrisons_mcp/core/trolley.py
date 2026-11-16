from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class TrolleyLine:
    """ One product in the trolley, with how many of it there are.

    Attributes:
        product_id:
            Identifies the product, in the same way as `Product.id`, so it can be given to `remove_from_trolley`.
        name:
            The full name of the product.
        quantity:
            How many of it are in the trolley. At least 1.
        price:
            What all of them cost together, in pounds, with offers already taken off.
        price_before_offers:
            What all of them would cost without offers. None if no offer applies.
        offer:
            The offer on the product, as the website words it, such as "Buy 2 for £4". None if there is no offer.
        offer_progress:
            How close the trolley is to earning the offer, such as "1/2" for one of the two needed for "Buy 2 for £4".
            None if the offer has no such steps, or there is no offer.
    """

    product_id: str
    name: str
    quantity: int
    price: Decimal
    price_before_offers: Decimal | None
    offer: str | None
    offer_progress: str | None


@dataclass(frozen=True)
class Trolley:
    """ Everything in the shopping trolley, and what it adds up to. Nothing has been ordered.

    Attributes:
        lines:
            The products in the trolley, one line for each.
        item_count:
            How many items there are altogether, counting each of a product separately.
        subtotal:
            What everything costs, in pounds, before savings from offers.
        savings:
            How much offers take off, in pounds. Zero if there are none.
        total:
            What everything costs, in pounds, after savings. This is what would be paid.
        minimum_spend:
            The least the trolley must come to before Morrisons will deliver it, in pounds.
        shortfall_to_minimum_spend:
            How much more must be added to reach the minimum spend, in pounds. Zero once it is reached.
    """

    lines: tuple[TrolleyLine, ...]
    item_count: int
    subtotal: Decimal
    savings: Decimal
    total: Decimal
    minimum_spend: Decimal
    shortfall_to_minimum_spend: Decimal
