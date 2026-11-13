from dataclasses import dataclass, replace
from uuid import UUID

from .basket_line import BasketLine


@dataclass(frozen=True)
class ShoppingListItem:
    """ Something to buy, worked out from everything in the basket.

    Attributes:
        name:
            What to buy, as the recipe or the person wrote it, such as "500g lamb mince" or "Milk".
        quantity:
            How many of it to buy. At least 1.
        needed_for:
            The names of the recipes that need it, in the order they are in the basket. Empty if it was only added as an
            item of its own.
    """

    name: str
    quantity: int
    needed_for: tuple[str, ...]


@dataclass(frozen=True)
class Basket:
    """ What the home wants to buy: recipes to buy the ingredients for, and items to buy as they are.

    A basket never changes. Each change gives a new basket, which the store then keeps.

    Attributes:
        lines:
            Everything in the basket, in the order it was first added. No two lines are for the same thing.
    """

    lines: tuple[BasketLine, ...] = ()

    def add(self, addition: BasketLine) -> Basket:
        """ Adds a line to the basket. If the basket already has a line for the same thing, that line's quantity grows
        instead, and it takes the addition's name and recipe, which may have been edited since it was first added.

        Args:
            addition:
                The line to add.

        Returns:
            The basket with the line added.
        """
        for line in self.lines:
            if line.is_for_same_thing_as(addition):
                merged_line = replace(addition, quantity=line.quantity + addition.quantity, id=line.id)
                return self._with_line_replaced(line.id, merged_line)
        return Basket(self.lines + (addition,))

    def change_quantity(self, line_id: UUID, quantity_change: int) -> Basket:
        """ Raises or lowers the quantity of one line. A line whose quantity falls to 0 or below is taken out. Does
        nothing if the basket has no such line, as another screen may have taken it out already.

        Args:
            line_id:
                Identifier of the line to change.
            quantity_change:
                How much to add to its quantity, such as 1 or -1. Changes are given as amounts to add, rather than as
                new quantities, so that changes made at the same time on two screens both count.

        Returns:
            The basket with the quantity changed.
        """
        line = next((line for line in self.lines if line.id == line_id), None)
        if line is None:
            return self

        new_quantity = line.quantity + quantity_change
        if new_quantity < 1:
            return self.remove(line_id)
        return self._with_line_replaced(line_id, replace(line, quantity=new_quantity))

    def remove(self, line_id: UUID) -> Basket:
        """ Takes a line out of the basket. Does nothing if the basket has no such line.

        Args:
            line_id:
                Identifier of the line to take out.

        Returns:
            The basket without the line.
        """
        return Basket(tuple(line for line in self.lines if line.id != line_id))

    def list_shopping(self) -> tuple[ShoppingListItem, ...]:
        """ Works out everything to buy: each recipe's ingredients, as many times over as the recipe's quantity, and
        each item. Things that are written the same, ignoring capitals and surrounding whitespace, are bought together,
        so that two recipes that both need "1 onion" give one item with a quantity of 2.

        This is what a shopper is asked to buy.

        Returns:
            Everything to buy, in the order it first appears in the basket.
        """
        items_by_name: dict[str, ShoppingListItem] = {}
        for line in self.lines:
            names_to_buy = line.recipe.ingredients if line.recipe else (line.name,)
            needed_for = (line.name,) if line.recipe else ()
            for name in names_to_buy:
                key = name.strip().casefold()
                existing_item = items_by_name.get(key)
                if existing_item is None:
                    items_by_name[key] = ShoppingListItem(name=name.strip(), quantity=line.quantity, needed_for=needed_for)
                else:
                    items_by_name[key] = replace(
                        existing_item,
                        quantity=existing_item.quantity + line.quantity,
                        needed_for=_merge_names(existing_item.needed_for, needed_for),
                    )
        return tuple(items_by_name.values())

    def _with_line_replaced(self, line_id: UUID, new_line: BasketLine) -> Basket:
        return Basket(tuple(new_line if line.id == line_id else line for line in self.lines))


def _merge_names(names: tuple[str, ...], more_names: tuple[str, ...]) -> tuple[str, ...]:
    """ Joins two lists of names, leaving out any in the second that are already in the first. """
    return names + tuple(name for name in more_names if name not in names)
