from dataclasses import dataclass


@dataclass(frozen=True)
class ShoppingListItem:
    """ Something to buy, as the shopping API works it out from the home's basket.

    Attributes:
        name:
            What to buy, as a recipe or a person wrote it, such as "500g lamb mince".
        quantity:
            How many of it to buy, such as 2 for two recipes that each need "500g lamb mince". At least 1.
        needed_for:
            The names of the recipes that need it. Empty if it was added as an item of its own.
    """

    name: str
    quantity: int
    needed_for: tuple[str, ...]
