from uuid import uuid7

import pytest

from shopping_api.core.basket_line import BasketLine, BasketRecipe


def test_has_quantity_of_one_and_no_recipe_when_created_with_only_a_name() -> None:
    line = BasketLine(name="Milk")

    assert (line.quantity, line.recipe) == (1, None)


def test_raises_when_name_is_blank() -> None:
    with pytest.raises(ValueError, match="name"):
        BasketLine(name="  ")


def test_raises_when_quantity_is_less_than_one() -> None:
    with pytest.raises(ValueError, match="at least 1"):
        BasketLine(name="Milk", quantity=0)


def test_raises_when_recipe_has_no_ingredients() -> None:
    with pytest.raises(ValueError, match="at least one ingredient"):
        BasketRecipe(id=uuid7(), ingredients=())


def test_raises_when_a_recipe_ingredient_is_blank() -> None:
    with pytest.raises(ValueError, match="must not be blank"):
        BasketRecipe(id=uuid7(), ingredients=("Beans", " "))


def test_is_for_same_thing_when_items_have_same_name_in_different_capitals() -> None:
    assert BasketLine(name="Milk").is_for_same_thing_as(BasketLine(name=" milk "))


def test_is_for_same_thing_when_lines_are_for_same_recipe_under_different_names() -> None:
    recipe_id = uuid7()
    shepherds_pie = BasketLine(name="Shepherd's pie", recipe=BasketRecipe(id=recipe_id, ingredients=("Lamb mince",)))
    cottage_pie = BasketLine(name="Cottage pie", recipe=BasketRecipe(id=recipe_id, ingredients=("Beef mince",)))

    assert shepherds_pie.is_for_same_thing_as(cottage_pie)


def test_is_not_for_same_thing_when_an_item_has_same_name_as_a_recipe() -> None:
    recipe_line = BasketLine(name="Lasagne", recipe=BasketRecipe(id=uuid7(), ingredients=("Pasta",)))

    assert not recipe_line.is_for_same_thing_as(BasketLine(name="Lasagne"))
