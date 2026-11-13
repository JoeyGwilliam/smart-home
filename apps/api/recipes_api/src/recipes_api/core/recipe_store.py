from pathlib import Path
from uuid import UUID

from sqlalchemy import JSON, URL, LargeBinary, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool

from .recipe import Recipe
from .recipe_picture import RecipePicture


class PictureUnavailableError(ValueError):
    """ A recipe named a picture that it can't have: one that isn't stored, or that belongs to another recipe. """


class RecipeStore:
    """ A store of recipes and their pictures, in a SQLite database.

    Each picture belongs to at most one recipe, and goes when that recipe stops using it, so that pictures never
    outlive their recipes.
    """

    def __init__(self, database_path: Path) -> None:
        """ Connects to a recipe database, creating the file and its tables if they don't exist.

        Args:
            database_path:
                Location of the SQLite database file. Its directory must exist.

        Raises:
            sqlalchemy.exc.OperationalError: If the database file cannot be opened.
        """
        url = URL.create("sqlite", database=str(database_path))
        engine = create_engine(url, poolclass=NullPool)
        _RecipeDBBase.metadata.create_all(engine)

        self._begin_session = sessionmaker(engine).begin

    def save_recipe(self, recipe: Recipe) -> None:
        """ Stores a recipe, replacing any existing recipe with the same id. If that recipe had a different picture,
        the old picture is deleted.

        Args:
            recipe:
                The recipe to store. Its picture, if it has one, must already be stored, and must not belong to any
                other recipe.

        Raises:
            PictureUnavailableError: If the recipe's picture isn't stored, or belongs to another recipe.
        """
        with self._begin_session() as session:
            if recipe.picture_id is not None:
                _check_picture_is_available(session, recipe.picture_id, recipe.id)

            existing_row = session.get(_RecipeRow, recipe.id)
            if existing_row and existing_row.picture_id not in (None, recipe.picture_id):
                session.execute(delete(_RecipePictureRow).where(_RecipePictureRow.id == existing_row.picture_id))

            session.merge(_RecipeRow.from_recipe(recipe))

    def get_recipe(self, recipe_id: UUID) -> Recipe | None:
        """ Finds a single recipe.

        Args:
            recipe_id:
                Identifier of the recipe to find.

        Returns:
            The matching recipe, or None if there isn't one.
        """
        with self._begin_session() as session:
            row = session.get(_RecipeRow, recipe_id)
            return row.to_recipe() if row else None

    def list_recipes(self) -> list[Recipe]:
        """ Lists every stored recipe.

        Returns:
            All recipes, in alphabetical order of name, ignoring capitals.
        """
        with self._begin_session() as session:
            recipes = [row.to_recipe() for row in session.scalars(select(_RecipeRow))]
        return sorted(recipes, key=lambda recipe: recipe.name.casefold())

    def delete_recipe(self, recipe_id: UUID) -> None:
        """ Ensures that a recipe and its picture are no longer stored. Does nothing if the recipe doesn't exist.

        Args:
            recipe_id:
                Identifier of the recipe to delete.
        """
        with self._begin_session() as session:
            row = session.get(_RecipeRow, recipe_id)
            if row is None:
                return
            if row.picture_id is not None:
                session.execute(delete(_RecipePictureRow).where(_RecipePictureRow.id == row.picture_id))
            session.delete(row)

    def save_picture(self, picture: RecipePicture) -> None:
        """ Stores a picture, so that a recipe can then be saved with it.

        Args:
            picture:
                The picture to store. Its id must not already be stored, as a picture never changes.
        """
        with self._begin_session() as session:
            session.add(_RecipePictureRow(id=picture.id, content=picture.content, content_type=picture.content_type))

    def get_picture(self, picture_id: UUID) -> RecipePicture | None:
        """ Finds a single picture.

        Args:
            picture_id:
                Identifier of the picture to find.

        Returns:
            The matching picture, or None if there isn't one.
        """
        with self._begin_session() as session:
            row = session.get(_RecipePictureRow, picture_id)
            return RecipePicture(content=row.content, content_type=row.content_type, id=row.id) if row else None


def _check_picture_is_available(session: Session, picture_id: UUID, recipe_id: UUID) -> None:
    """ Raises PictureUnavailableError unless the picture is stored and belongs to no recipe other than this one. """
    if session.get(_RecipePictureRow, picture_id) is None:
        raise PictureUnavailableError(f"No picture has the id {picture_id}. Upload the picture first.")

    other_owner = session.scalar(select(_RecipeRow.id).where(_RecipeRow.picture_id == picture_id, _RecipeRow.id != recipe_id))
    if other_owner is not None:
        raise PictureUnavailableError(f"The picture {picture_id} already belongs to another recipe.")


class _RecipeDBBase(DeclarativeBase):
    pass


class _RecipeRow(_RecipeDBBase):
    """ The database representation of a Recipe. """
    __tablename__ = "recipes"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str]
    # A recipe's ingredients are only ever read and replaced together with the recipe, in order, so they are kept
    # inside its row rather than in a table of their own.
    ingredients: Mapped[list[str]] = mapped_column(JSON)
    instructions: Mapped[str | None]
    time_minutes: Mapped[int | None]
    picture_id: Mapped[UUID | None]

    @classmethod
    def from_recipe(cls, recipe: Recipe) -> _RecipeRow:
        return cls(
            id=recipe.id,
            name=recipe.name,
            ingredients=list(recipe.ingredients),
            instructions=recipe.instructions,
            time_minutes=recipe.time_minutes,
            picture_id=recipe.picture_id,
        )

    def to_recipe(self) -> Recipe:
        return Recipe(
            name=self.name,
            ingredients=tuple(self.ingredients),
            instructions=self.instructions,
            time_minutes=self.time_minutes,
            picture_id=self.picture_id,
            id=self.id,
        )


class _RecipePictureRow(_RecipeDBBase):
    """ The database representation of a RecipePicture. """
    __tablename__ = "recipe_pictures"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    content: Mapped[bytes] = mapped_column(LargeBinary)
    content_type: Mapped[str]
