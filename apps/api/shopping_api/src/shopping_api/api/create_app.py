import os
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Request

from shopping_api.api.basket_schema import BasketAdditionSchema, BasketSchema, QuantityChangeSchema
from shopping_api.core.basket import Basket
from shopping_api.core.basket_store import BasketStore


def create_app(database_path: Path) -> FastAPI:
    """ Creates the shopping API, backed by a single database.

    Args:
        database_path:
            Location of the SQLite database file, which is created if it doesn't exist. Its directory must exist.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Shopping API")
    app.state.basket_store = BasketStore(database_path)
    app.include_router(_basket_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the shopping API, using the database named by the `SHOPPING_DATABASE_PATH` environment variable.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If the environment variable is not set. There is deliberately no default, so that a configuration
            mistake stops the server rather than silently creating a new, empty database.
    """
    return create_app(Path(os.environ["SHOPPING_DATABASE_PATH"]))


def _get_store(request: Request) -> BasketStore:
    return request.app.state.basket_store


_StoreDependency = Annotated[BasketStore, Depends(_get_store)]

# Every request answers with the whole basket as it now is, so that a screen can show the result of its change
# without asking again.
_basket_router = APIRouter(prefix="/basket", tags=["basket"])


@_basket_router.get("")
def get_basket(store: _StoreDependency) -> BasketSchema:
    return BasketSchema.from_basket(store.get_basket())


@_basket_router.post("/lines")
def add_to_basket(addition: BasketAdditionSchema, store: _StoreDependency) -> BasketSchema:
    """ Adds a recipe or an item to the basket, or adds to the quantity of the line already there for it. """
    line = addition.to_line()
    return BasketSchema.from_basket(store.change_basket(lambda basket: basket.add(line)))


@_basket_router.patch("/lines/{line_id}")
def change_quantity(line_id: UUID, change: QuantityChangeSchema, store: _StoreDependency) -> BasketSchema:
    """ Raises or lowers a line's quantity, taking it out if it falls to 0. Does nothing if there is no such line. """
    changed_basket = store.change_basket(lambda basket: basket.change_quantity(line_id, change.quantity_change))
    return BasketSchema.from_basket(changed_basket)


@_basket_router.delete("/lines/{line_id}")
def remove_from_basket(line_id: UUID, store: _StoreDependency) -> BasketSchema:
    """ Takes a line out of the basket. Does nothing if there is no such line. """
    return BasketSchema.from_basket(store.change_basket(lambda basket: basket.remove(line_id)))


@_basket_router.delete("/lines")
def empty_basket(store: _StoreDependency) -> BasketSchema:
    return BasketSchema.from_basket(store.change_basket(lambda _basket: Basket()))
