from pathlib import Path
from uuid import uuid7

import pytest

from shopping_api.core.basket import Basket
from shopping_api.core.basket_line import BasketLine, BasketRecipe
from shopping_api.core.basket_store import BasketStore


def test_gives_empty_basket_when_database_is_new(tmp_path: Path) -> None:
    store = BasketStore(tmp_path / "shopping.db")

    assert store.get_basket() == Basket()


def test_keeps_every_field_and_the_order_when_database_is_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "shopping.db"
    pie = BasketLine(name="Shepherd's pie", quantity=2, recipe=BasketRecipe(id=uuid7(), ingredients=("Lamb mince", "Potatoes")))
    milk = BasketLine(name="Milk")
    BasketStore(database_path).change_basket(lambda _basket: Basket((pie, milk)))

    reopened_basket = BasketStore(database_path).get_basket()

    assert reopened_basket == Basket((pie, milk))


def test_returns_and_keeps_changed_basket_when_changing_it(tmp_path: Path) -> None:
    store = BasketStore(tmp_path / "shopping.db")
    milk = BasketLine(name="Milk")

    changed_basket = store.change_basket(lambda basket: basket.add(milk))

    assert changed_basket == Basket((milk,))
    assert store.get_basket() == changed_basket


def test_leaves_basket_as_it_was_when_change_raises(tmp_path: Path) -> None:
    store = BasketStore(tmp_path / "shopping.db")
    store.change_basket(lambda basket: basket.add(BasketLine(name="Milk")))
    basket_before = store.get_basket()

    def fail_to_change(_basket: Basket) -> Basket:
        raise ValueError("Not this time.")

    with pytest.raises(ValueError):
        store.change_basket(fail_to_change)

    assert store.get_basket() == basket_before
