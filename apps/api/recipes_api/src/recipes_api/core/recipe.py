from dataclasses import dataclass, field
from uuid import UUID, uuid7


@dataclass(frozen=True)
class Recipe:
    """ Something to cook, and what it takes.

    To edit a recipe, make a copy with `dataclasses.replace`, which keeps its id, and save the copy.

    Attributes:
        name:
            What the dish is called, such as "Shepherd's pie". Must contain non-whitespace text.
        ingredients:
            What goes in it, one ingredient to each item, such as "500g lamb mince", in the order the recipe lists
            them. There must be at least one, and each must contain non-whitespace text, so that a shopping list can
            be made from them.
        instructions:
            How to make it, as free text, or None if the recipe doesn't say. Must contain non-whitespace text if it
            is given, so that a recipe without instructions only ever looks one way.
        time_minutes:
            Roughly how long it takes to make, in whole minutes, or None if nobody has estimated it. Must be at least
            1 if it is given.
        picture_id:
            Identifier of the recipe's picture in the same store, or None if it has none.
        id:
            Unique identifier that stays the same when the recipe is edited. Generated identifiers sort by creation
            time.

    Raises:
        ValueError: If the name, an ingredient or the instructions are blank, if there are no ingredients, or if the
            time is less than a minute.
    """

    name: str
    ingredients: tuple[str, ...]
    instructions: str | None = None
    time_minutes: int | None = None
    picture_id: UUID | None = None
    id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("A recipe's name must not be blank.")

        if not self.ingredients:
            raise ValueError("A recipe must have at least one ingredient.")

        if any(not ingredient.strip() for ingredient in self.ingredients):
            raise ValueError("A recipe's ingredients must not be blank.")

        if self.instructions is not None and not self.instructions.strip():
            raise ValueError("A recipe's instructions must not be blank. Leave them out instead.")

        if self.time_minutes is not None and self.time_minutes < 1:
            raise ValueError("A recipe's time_minutes must be at least 1.")
