from typing import Self
from uuid import UUID, uuid7

from pydantic import BaseModel, ConfigDict, Field, model_validator

from recipes_api.core.recipe import Recipe


class RecipeSchema(BaseModel):
    """ The JSON representation of a recipe, used for both requests and responses.

    Attributes:
        name:
            What the dish is called. Must contain non-whitespace text.
        ingredients:
            What goes in it, one ingredient to each item, in the order the recipe lists them. There must be at least
            one, and each must contain non-whitespace text.
        instructions:
            How to make it, or null if the recipe doesn't say. Must contain non-whitespace text if it is given.
        time_minutes:
            Roughly how long it takes to make, in whole minutes, or null if nobody has estimated it. Must be at least
            1 if it is given.
        picture_id:
            Identifier of the recipe's picture, or null if it has none. A picture is uploaded to /pictures first,
            which gives it its id, and must not belong to another recipe. Changing it, or deleting the recipe,
            deletes the picture it named before.
        id:
            Unique identifier that stays the same when the recipe is edited. Ignored in a request, so that clients
            can send back a recipe that they received.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    name: str
    ingredients: list[str]
    instructions: str | None = None
    time_minutes: int | None = None
    picture_id: UUID | None = None
    id: UUID = Field(default_factory=uuid7)

    @model_validator(mode="after")
    def _apply_recipe_rules(self) -> Self:
        # Recipe owns the rules for a valid recipe. A ValueError raised here becomes a 422 response.
        self.to_recipe(self.id)
        return self

    @classmethod
    def from_recipe(cls, recipe: Recipe) -> Self:
        """ Creates the JSON representation of a recipe.

        Args:
            recipe:
                The recipe to represent.

        Returns:
            The representation, with the recipe's id.
        """
        return cls(
            name=recipe.name,
            ingredients=list(recipe.ingredients),
            instructions=recipe.instructions,
            time_minutes=recipe.time_minutes,
            picture_id=recipe.picture_id,
            id=recipe.id,
        )

    def to_recipe(self, recipe_id: UUID) -> Recipe:
        """ Converts this representation to a recipe.

        Args:
            recipe_id:
                The id of the new recipe, which replaces any id in this representation.

        Returns:
            The recipe.
        """
        return Recipe(
            name=self.name,
            ingredients=tuple(self.ingredients),
            instructions=self.instructions,
            time_minutes=self.time_minutes,
            picture_id=self.picture_id,
            id=recipe_id,
        )


class PictureCreatedSchema(BaseModel):
    """ The response to uploading a picture.

    Attributes:
        id:
            The new picture's identifier, which a recipe names as its picture_id.
    """

    id: UUID
