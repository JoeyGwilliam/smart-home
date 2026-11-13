from collections.abc import Callable
from pathlib import Path
from threading import Lock
from uuid import UUID

from sqlalchemy import JSON, URL, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool

from .basket import Basket
from .basket_line import BasketLine, BasketRecipe


class BasketStore:
    """ The home's one shopping basket, kept in a SQLite database, which every screen shares. """

    def __init__(self, database_path: Path) -> None:
        """ Connects to a basket database, creating the file and its tables if they don't exist. A new database holds an
        empty basket.

        Args:
            database_path:
                Location of the SQLite database file. Its directory must exist.

        Raises:
            sqlalchemy.exc.OperationalError: If the database file cannot be opened.
        """
        url = URL.create("sqlite", database=str(database_path))
        engine = create_engine(url, poolclass=NullPool)
        _BasketDBBase.metadata.create_all(engine)

        self._begin_session = sessionmaker(engine).begin
        # SQLite would refuse one of two changes that read the basket at the same time, rather than make it wait, so
        # changes wait for each other here instead. The API is served by a single process, so this covers them all.
        self._change_lock = Lock()

    def get_basket(self) -> Basket:
        """ Gives the basket as it is now.

        Returns:
            The basket.
        """
        with self._begin_session() as session:
            rows = session.scalars(select(_BasketLineRow).order_by(_BasketLineRow.position))
            return Basket(tuple(row.to_line() for row in rows))

    def change_basket(self, change: Callable[[Basket], Basket]) -> Basket:
        """ Changes the basket, as one step that no other change can come between, so that changes made at the same
        time on two screens both count.

        Args:
            change:
                Gives the basket as it should be, from the basket as it is, such as `lambda basket: basket.add(line)`.

        Returns:
            The basket as it now is.

        Raises:
            ValueError: If the change raises it, in which case the basket is left as it was.
        """
        with self._change_lock, self._begin_session() as session:
            rows = session.scalars(select(_BasketLineRow).order_by(_BasketLineRow.position))
            changed_basket = change(Basket(tuple(row.to_line() for row in rows)))

            # The basket is only ever a few dozen lines, so it is simplest to write all of it again.
            session.execute(delete(_BasketLineRow))
            session.add_all(_BasketLineRow.from_line(line, position) for position, line in enumerate(changed_basket.lines))
        return changed_basket


class _BasketDBBase(DeclarativeBase):
    pass


class _BasketLineRow(_BasketDBBase):
    """ The database representation of a BasketLine. """
    __tablename__ = "basket_lines"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    # Where the line comes in the basket, counting from 0.
    position: Mapped[int]
    name: Mapped[str]
    quantity: Mapped[int]
    recipe_id: Mapped[UUID | None]
    # Only ever read and written with the line, in order, so they are kept inside its row. None when recipe_id is.
    recipe_ingredients: Mapped[list[str] | None] = mapped_column(JSON)

    @classmethod
    def from_line(cls, line: BasketLine, position: int) -> _BasketLineRow:
        return cls(
            id=line.id,
            position=position,
            name=line.name,
            quantity=line.quantity,
            recipe_id=line.recipe.id if line.recipe else None,
            recipe_ingredients=list(line.recipe.ingredients) if line.recipe else None,
        )

    def to_line(self) -> BasketLine:
        recipe = None
        if self.recipe_id is not None and self.recipe_ingredients is not None:
            recipe = BasketRecipe(id=self.recipe_id, ingredients=tuple(self.recipe_ingredients))
        return BasketLine(name=self.name, quantity=self.quantity, recipe=recipe, id=self.id)
