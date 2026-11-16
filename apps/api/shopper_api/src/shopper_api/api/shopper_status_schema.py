from decimal import Decimal
from typing import Self

from morrisons_mcp.core.trolley import Trolley, TrolleyLine
from pydantic import BaseModel

from shopper_api.core.claude_settings import ClaudeEffort, ClaudeModel
from shopper_api.core.draft_order import DraftOrder, ItemChoice
from shopper_api.core.progress_event import ProgressKind
from shopper_api.core.shopper import ShopperState, ShopperStatus, ShoppingTrip
from shopper_api.core.shopping_list_item import ShoppingListItem

# Amounts of money are sent as strings of pounds, such as "12.50", so that no pennies are lost to rounding.


class ShoppingListItemSchema(BaseModel):
    """ The JSON representation of something that a shop was to buy.

    Attributes:
        name:
            What to buy, such as "500g lamb mince".
        quantity:
            How many of it to buy. At least 1.
        needed_for:
            The names of the recipes that need it. Empty if it was added as an item of its own.
    """

    name: str
    quantity: int
    needed_for: list[str]

    @classmethod
    def from_item(cls, item: ShoppingListItem) -> Self:
        """ Creates the JSON representation of an item. """
        return cls(name=item.name, quantity=item.quantity, needed_for=list(item.needed_for))


class ProgressEventSchema(BaseModel):
    """ The JSON representation of one thing that happened during a shop.

    Attributes:
        kind:
            What the event reports.
        text:
            The event in words.
    """

    kind: ProgressKind
    text: str


class ItemChoiceSchema(BaseModel):
    """ The JSON representation of what Claude chose for one item of the shopping list.

    Attributes:
        item:
            The item, as it was written.
        products:
            What Claude put in the trolley for it, each with how many. Empty if it found nothing suitable.
        note:
            Why, for a person to read.
    """

    item: str
    products: list[str]
    note: str

    @classmethod
    def from_choice(cls, choice: ItemChoice) -> Self:
        """ Creates the JSON representation of a choice. """
        return cls(item=choice.item, products=list(choice.products), note=choice.note)


class TrolleyLineSchema(BaseModel):
    """ The JSON representation of one product in the trolley.

    Attributes:
        name:
            The full name of the product.
        quantity:
            How many of it there are. At least 1.
        price:
            What all of them cost together, with offers taken off.
        offer:
            The offer on the product, as Morrisons words it, or null if there is none.
    """

    name: str
    quantity: int
    price: Decimal
    offer: str | None

    @classmethod
    def from_line(cls, line: TrolleyLine) -> Self:
        """ Creates the JSON representation of a line of the trolley. """
        return cls(name=line.name, quantity=line.quantity, price=line.price, offer=line.offer)


class TrolleySchema(BaseModel):
    """ The JSON representation of the trolley.

    Attributes:
        lines:
            The products in it, one line for each.
        total:
            What it would cost, with savings taken off.
        savings:
            How much offers take off. Zero if there are none.
        shortfall_to_minimum_spend:
            How much more must be added before Morrisons will deliver. Zero once the minimum is reached.
    """

    lines: list[TrolleyLineSchema]
    total: Decimal
    savings: Decimal
    shortfall_to_minimum_spend: Decimal

    @classmethod
    def from_trolley(cls, trolley: Trolley) -> Self:
        """ Creates the JSON representation of a trolley. """
        return cls(
            lines=[TrolleyLineSchema.from_line(line) for line in trolley.lines],
            total=trolley.total,
            savings=trolley.savings,
            shortfall_to_minimum_spend=trolley.shortfall_to_minimum_spend,
        )


class DraftOrderSchema(BaseModel):
    """ The JSON representation of a trolley that Claude has filled, ready for a person to check and order.

    Attributes:
        summary:
            How Claude says the shop went, and anything to look at before ordering.
        item_choices:
            What Claude chose for each item of the shopping list, in the list's order.
        trolley:
            What the trolley actually holds, as read from Morrisons.
    """

    summary: str
    item_choices: list[ItemChoiceSchema]
    trolley: TrolleySchema

    @classmethod
    def from_draft_order(cls, draft_order: DraftOrder) -> Self:
        """ Creates the JSON representation of a draft order. """
        return cls(
            summary=draft_order.report.summary,
            item_choices=[ItemChoiceSchema.from_choice(choice) for choice in draft_order.report.item_choices],
            trolley=TrolleySchema.from_trolley(draft_order.trolley),
        )


class ShoppingTripSchema(BaseModel):
    """ The JSON representation of the latest shop.

    Attributes:
        shopping_list:
            What was to be bought. Empty until it has been read.
        model:
            The model that was asked to shop.
        effort:
            How hard it was asked to think.
        events:
            Everything that has happened during the shop, oldest first.
        draft_order:
            The filled trolley, or null until the shop has finished, or if it failed.
    """

    shopping_list: list[ShoppingListItemSchema]
    model: ClaudeModel
    effort: ClaudeEffort
    events: list[ProgressEventSchema]
    draft_order: DraftOrderSchema | None

    @classmethod
    def from_trip(cls, trip: ShoppingTrip) -> Self:
        """ Creates the JSON representation of a shop. """
        return cls(
            shopping_list=[ShoppingListItemSchema.from_item(item) for item in trip.shopping_list],
            model=trip.claude_settings.model,
            effort=trip.claude_settings.effort,
            events=[ProgressEventSchema(kind=event.kind, text=event.text) for event in trip.events],
            draft_order=DraftOrderSchema.from_draft_order(trip.draft_order) if trip.draft_order else None,
        )


class ShopperStatusSchema(BaseModel):
    """ The JSON representation of the shopper.

    Attributes:
        state:
            What the shopper is doing.
        is_logged_in:
            Whether shops fill a Morrisons account's trolley, rather than a guest's that only exists on the home server.
        login_failure:
            Why the last attempt to log in went wrong, or null if it didn't.
        trip:
            The latest shop, or null if there has never been one.
    """

    state: ShopperState
    is_logged_in: bool
    login_failure: str | None
    trip: ShoppingTripSchema | None

    @classmethod
    def from_status(cls, status: ShopperStatus) -> Self:
        """ Creates the JSON representation of the shopper's status. """
        return cls(
            state=status.state,
            is_logged_in=status.is_logged_in,
            login_failure=status.login_failure,
            trip=ShoppingTripSchema.from_trip(status.trip) if status.trip else None,
        )
