from dataclasses import dataclass

from morrisons_mcp.core.trolley import Trolley


@dataclass(frozen=True)
class ItemChoice:
    """ What Claude chose for one item of the shopping list, and why.

    Attributes:
        item:
            The item of the shopping list, as it was written, such as "500g lamb mince".
        products:
            What Claude put in the trolley for it, each with how many, such as "2 × Morrisons Lamb Mince 250g". Empty
            if it found nothing suitable.
        note:
            Why Claude chose them, or why it chose nothing, in a sentence or two for a person.
    """

    item: str
    products: tuple[str, ...]
    note: str


@dataclass(frozen=True)
class ShoppingReport:
    """ Claude's own account of a shop.

    Attributes:
        summary:
            How the shop went overall, and anything a person should look at before ordering, in a few sentences.
        item_choices:
            One for each item of the shopping list, in the list's order.
    """

    summary: str
    item_choices: tuple[ItemChoice, ...]


@dataclass(frozen=True)
class DraftOrder:
    """ A Morrisons trolley that Claude has filled from the shopping list, ready for a person to check and order.
    Nothing has been ordered.

    Attributes:
        report:
            What Claude says it chose, and why.
        trolley:
            What the trolley actually holds, as read from Morrisons once Claude had finished. This, rather than the
            report, is what would be ordered.
    """

    report: ShoppingReport
    trolley: Trolley
