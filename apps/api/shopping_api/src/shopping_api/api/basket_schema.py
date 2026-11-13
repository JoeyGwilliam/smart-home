from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from shopping_api.core.basket import Basket, ShoppingListItem
from shopping_api.core.basket_line import BasketLine, BasketRecipe


class BasketRecipeSchema(BaseModel):
    """ The JSON representation of the recipe that a line of the basket is for.

    Attributes:
        id:
            Identifier of the recipe in the recipes API.
        ingredients:
            What one of the dish needs, one ingredient to each item. There must be at least one, and each must contain
            non-whitespace text.
    """
    model_config = ConfigDict(extra="forbid")

    id: UUID
    ingredients: list[str]


class BasketLineSchema(BaseModel):
    """ The JSON representation of one line of the basket, as it is sent in a response.

    Attributes:
        id:
            Unique identifier that stays the same as the quantity changes.
        name:
            The recipe's name, or the item to buy.
        quantity:
            How many of the dish to buy for, or how many of the item to buy. At least 1.
        recipe:
            The recipe that the line is for, or null if it is an item to buy as it is.
    """

    id: UUID
    name: str
    quantity: int
    recipe: BasketRecipeSchema | None

    @classmethod
    def from_line(cls, line: BasketLine) -> Self:
        recipe = BasketRecipeSchema(id=line.recipe.id, ingredients=list(line.recipe.ingredients)) if line.recipe else None
        return cls(id=line.id, name=line.name, quantity=line.quantity, recipe=recipe)


class BasketAdditionSchema(BaseModel):
    """ A request to add something to the basket. If the basket already has a line for the same recipe, or an item with
    the same name, ignoring capitals, that line's quantity grows instead, and it takes this name and recipe.

    Attributes:
        name:
            The recipe's name, or the item to buy, such as "Milk". Must contain non-whitespace text.
        quantity:
            How many of the dish to buy for, or how many of the item to buy. At least 1. Defaults to 1.
        recipe:
            The recipe to buy the ingredients for, as the recipes API holds it now, or null for an item to buy as it is.
    """
    model_config = ConfigDict(extra="forbid")

    name: str
    quantity: int = 1
    recipe: BasketRecipeSchema | None = None

    @model_validator(mode="after")
    def _apply_line_rules(self) -> Self:
        # BasketLine owns the rules for a valid line. A ValueError raised here becomes a 422 response.
        self.to_line()
        return self

    def to_line(self) -> BasketLine:
        """ Converts this request to a new line of the basket, with a new id. """
        recipe = BasketRecipe(id=self.recipe.id, ingredients=tuple(self.recipe.ingredients)) if self.recipe else None
        return BasketLine(name=self.name, quantity=self.quantity, recipe=recipe)


class QuantityChangeSchema(BaseModel):
    """ A request to raise or lower the quantity of one line of the basket.

    Attributes:
        quantity_change:
            How much to add to the quantity, such as 1 or -1. A line whose quantity falls to 0 or below is taken out.
    """
    model_config = ConfigDict(extra="forbid")

    quantity_change: int


class ShoppingListItemSchema(BaseModel):
    """ The JSON representation of something to buy.

    Attributes:
        name:
            What to buy, such as "500g lamb mince" or "Milk".
        quantity:
            How many of it to buy. At least 1.
        needed_for:
            The names of the recipes in the basket that need it. Empty if it was only added as an item of its own.
    """

    name: str
    quantity: int
    needed_for: list[str]

    @classmethod
    def from_item(cls, item: ShoppingListItem) -> Self:
        return cls(name=item.name, quantity=item.quantity, needed_for=list(item.needed_for))


class BasketSchema(BaseModel):
    """ The JSON representation of the basket, as every request about it answers with.

    Attributes:
        lines:
            Everything in the basket, in the order it was first added.
        shopping_list:
            Everything to buy, worked out from the lines: each recipe's ingredients, as many times over as its
            quantity, and each item, with things that are written the same bought together. This is what a shopper is
            asked to buy.
    """

    lines: list[BasketLineSchema]
    shopping_list: list[ShoppingListItemSchema]

    @classmethod
    def from_basket(cls, basket: Basket) -> Self:
        return cls(
            lines=[BasketLineSchema.from_line(line) for line in basket.lines],
            shopping_list=[ShoppingListItemSchema.from_item(item) for item in basket.list_shopping()],
        )
