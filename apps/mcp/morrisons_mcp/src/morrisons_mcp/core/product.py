from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Product:
    """ One product as the Morrisons website lists it in search results and on offer pages.

    Attributes:
        id:
            Identifies the product to this server, and is what to give when adding it to the trolley. Only products
            from the latest search or offer page can be added, so look it up again if some time has passed.
        name:
            The full name, including the brand, such as "Morrisons British Semi Skimmed Milk 4 Pint".
        price:
            What one costs now, in pounds, with any offer that applies to a single item already taken off. None if the
            website shows no price, which happens when a product can't be bought.
        size:
            How much one holds, as written on the website, such as "2.272L" or "6 x 1L". None if it doesn't say.
        price_per_unit:
            What it costs by weight or volume, such as "£1.33/litre", for comparing different pack sizes. None if the
            website doesn't give one.
        offer:
            The offer on it, as the website words it, such as "Buy 2 for £4" or "Now £1.40, Was £2". None if there is
            no offer.
        offer_path:
            Where to find every product in the same offer, to give to `list_products_in_offer`. None if there is no
            offer.
        price_before_offer:
            What one cost before the offer. None if the website doesn't show one.
        rating:
            The average review score from 0 to 5. None if nobody has reviewed it.
        review_count:
            How many reviews the rating is from.
        is_available:
            Whether it can be added to the trolley right now. False when, for example, it is out of stock.
        quantity_in_trolley:
            How many of it are already in the trolley.
    """

    id: str
    name: str
    price: Decimal | None
    size: str | None
    price_per_unit: str | None
    offer: str | None
    offer_path: str | None
    price_before_offer: Decimal | None
    rating: float | None
    review_count: int
    is_available: bool
    quantity_in_trolley: int
