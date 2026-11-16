import re
from dataclasses import dataclass
from decimal import Decimal

from .product import Product
from .trolley import TrolleyLine

# Matches the card of one product, wherever the website shows it: in search results, on offer pages and in the trolley.
# The part of the attribute after the colon is the product's identifier.
CARD_SELECTOR = '[data-test^="fop-wrapper:"]'

# Runs in the browser, and gathers the text of every card it is given, with no interpretation. Reading is kept apart
# from understanding so that the part that breaks when the website changes is small, and the rest can be tested
# without a browser.
READ_CARDS_SCRIPT = """
cards => cards.map(card => {
    const textOf = selector => {
        const element = card.querySelector(selector);
        return element ? element.innerText.trim() : null;
    };
    const offerLink = card.querySelector('[data-retailer-anchor="fop-promotions"] a[href*="/offers/"]');
    // The link holds the offer's name, followed by a longer description for screen readers.
    const offerText = offerLink ? offerLink.innerText.split('Offer name:')[0].trim() : null;

    let offerProgress = null;
    card.querySelectorAll('[data-retailer-anchor="fop-promotions"] *').forEach(element => {
        const text = element.innerText ? element.innerText.trim() : '';
        if (element.children.length === 0 && /^\\d+\\s*\\/\\s*\\d+$/.test(text)) offerProgress = text;
    });

    const ratingElement = [...card.querySelectorAll('span')].find(span => /^Rating, /.test(span.innerText));
    const quantityInput = card.querySelector('[data-test="quantity-in-basket"]');
    const sizeElement = card.querySelector('[data-test="fop-size"] span');

    return {
        id: card.getAttribute('data-test').split(':')[1],
        name: textOf('[data-test="fop-title"]'),
        price_text: textOf('[data-test="fop-price"]'),
        price_before_offer_text: textOf('[data-test="fop-original-price"]'),
        size: sizeElement ? sizeElement.innerText.trim() : null,
        price_per_unit_text: textOf('[data-test="fop-price-per-unit"]'),
        offer_text: offerText || null,
        offer_path: offerLink ? new URL(offerLink.href).pathname : null,
        offer_progress: offerProgress,
        rating_text: ratingElement ? ratingElement.innerText.trim() : null,
        quantity_in_trolley: quantityInput ? Number(quantityInput.value) : 0,
        has_quantity_buttons:
            card.querySelector('[data-test="counter-button"], [data-test="counter:increment"]') !== null,
    };
})
"""

_PRICE_PATTERN = re.compile(r"£\s*(\d[\d,]*(?:\.\d+)?)")
_RATING_PATTERN = re.compile(r"Rating, ([\d.]+) out of 5 from (\d+) review")


@dataclass(frozen=True)
class RawCard:
    """ The text of one product card, exactly as `READ_CARDS_SCRIPT` found it.

    Attributes:
        id:
            The product's identifier.
        name:
            The product's name, or None if the card has none.
        price_text:
            The price shown, such as "£1.75", or None if there is none.
        price_before_offer_text:
            The crossed-out price before an offer, or None if there is none.
        size:
            The size line, such as "2.272L", or None if there is none.
        price_per_unit_text:
            The price by weight or volume, such as "(77.0p/litre)", or None if there is none.
        offer_text:
            The offer's name, or None if there is no offer.
        offer_path:
            The path of the offer's page, or None if there is no offer.
        offer_progress:
            Progress towards the offer, such as "1/2", or None if none is shown.
        rating_text:
            The sentence for screen readers that gives the rating, or None if the product has no reviews.
        quantity_in_trolley:
            The number in the card's quantity box, which is 0 when the product isn't in the trolley.
        has_quantity_buttons:
            Whether the card has buttons to add or change the quantity.
    """

    id: str
    name: str | None = None
    price_text: str | None = None
    price_before_offer_text: str | None = None
    size: str | None = None
    price_per_unit_text: str | None = None
    offer_text: str | None = None
    offer_path: str | None = None
    offer_progress: str | None = None
    rating_text: str | None = None
    quantity_in_trolley: int = 0
    has_quantity_buttons: bool = False


def parse_product(card: RawCard) -> Product:
    """ Understands a card from a search result or an offer page.

    Args:
        card:
            The card, as read from the page.

    Returns:
        The product it shows.
    """
    rating, review_count = _parse_rating(card.rating_text)
    return Product(
        id=card.id,
        name=card.name or "",
        price=parse_price(card.price_text),
        size=card.size,
        price_per_unit=_parse_price_per_unit(card.price_per_unit_text),
        offer=_first_line(card.offer_text),
        offer_path=card.offer_path,
        price_before_offer=parse_price(card.price_before_offer_text),
        rating=rating,
        review_count=review_count,
        is_available=card.has_quantity_buttons,
        quantity_in_trolley=card.quantity_in_trolley,
    )


def parse_trolley_line(card: RawCard) -> TrolleyLine:
    """ Understands a card from the trolley, where prices are for everything of a product rather than for one.

    Args:
        card:
            The card, as read from the trolley page.

    Returns:
        The line of the trolley it shows.
    """
    return TrolleyLine(
        product_id=card.id,
        name=card.name or "",
        quantity=card.quantity_in_trolley,
        price=parse_price(card.price_text) or Decimal(0),
        price_before_offers=parse_price(card.price_before_offer_text),
        offer=_first_line(card.offer_text),
        offer_progress=card.offer_progress,
    )


def parse_price(text: str | None) -> Decimal | None:
    """ Finds an amount of money in text such as "£1.75", "Minimum: £25.00" or "-£1.30".

    Args:
        text:
            Text that may contain an amount in pounds, or None.

    Returns:
        The amount in pounds, always positive, or None if the text has no amount.
    """
    match = _PRICE_PATTERN.search(text or "")
    return Decimal(match.group(1).replace(",", "")) if match else None


def _parse_price_per_unit(text: str | None) -> str | None:
    """ Turns "(£1.33/litre)" into "£1.33/litre", and "(77.0p/litre)" into "77.0p/litre". """
    stripped_text = (text or "").strip().strip("()").strip()
    return stripped_text or None


def _parse_rating(text: str | None) -> tuple[float | None, int]:
    match = _RATING_PATTERN.search(text or "")
    if match is None or int(match.group(2)) == 0:
        return None, 0
    return float(match.group(1)), int(match.group(2))


def _first_line(text: str | None) -> str | None:
    """ Keeps the offer's own wording, "Now £1.40, Was £2", and drops the unit price the website adds below. """
    return text.splitlines()[0].strip() if text else None
