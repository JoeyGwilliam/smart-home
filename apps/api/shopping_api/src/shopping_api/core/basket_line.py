from dataclasses import dataclass, field
from uuid import UUID, uuid7


@dataclass(frozen=True)
class BasketRecipe:
    """ The recipe that a line of the basket is for, as it was when it was last added.

    The basket keeps its own copy of the ingredients, rather than looking them up in the recipes API, so that it always
    says exactly what is to be bought, even if the recipe is later edited or deleted.

    Attributes:
        id:
            Identifier of the recipe in the recipes API.
        ingredients:
            What one of the dish needs, one ingredient to each item, such as "500g lamb mince". There must be at least
            one, and each must contain non-whitespace text.

    Raises:
        ValueError: If there are no ingredients, or one is blank.
    """

    id: UUID
    ingredients: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.ingredients:
            raise ValueError("A recipe in the basket must have at least one ingredient.")

        if any(not ingredient.strip() for ingredient in self.ingredients):
            raise ValueError("A recipe's ingredients must not be blank.")


@dataclass(frozen=True)
class BasketLine:
    """ One thing in the shopping basket: either a recipe, whose ingredients are to be bought, or an item to buy as it
    is, such as "Milk".

    Attributes:
        name:
            What the line is called: the recipe's name, or the item itself. Must contain non-whitespace text.
        quantity:
            How many of the dish to buy for, or how many of the item to buy. Must be at least 1.
        recipe:
            The recipe that the line is for, or None if it is an item to buy as it is.
        id:
            Unique identifier that stays the same as the quantity changes. Generated identifiers sort by creation time,
            so the basket lists its lines in the order they were first added.

    Raises:
        ValueError: If the name is blank, or the quantity is less than 1.
    """

    name: str
    quantity: int = 1
    recipe: BasketRecipe | None = None
    id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("A line of the basket must have a name.")

        if self.quantity < 1:
            raise ValueError("A line of the basket must have a quantity of at least 1.")

    def is_for_same_thing_as(self, other: BasketLine) -> bool:
        """ Whether two lines ask for the same thing, so that they belong together as one line: they are for the same
        recipe, or they are both items with the same name, ignoring capitals and surrounding whitespace.
        """
        if self.recipe is not None or other.recipe is not None:
            return self.recipe is not None and other.recipe is not None and self.recipe.id == other.recipe.id
        return _normalise_name(self.name) == _normalise_name(other.name)


def _normalise_name(name: str) -> str:
    return name.strip().casefold()
