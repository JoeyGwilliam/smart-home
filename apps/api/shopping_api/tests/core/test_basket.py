from uuid import uuid7

from shopping_api.core.basket import Basket, ShoppingListItem
from shopping_api.core.basket_line import BasketLine, BasketRecipe


def test_appends_line_when_adding_something_new() -> None:
    milk = BasketLine(name="Milk")
    bread = BasketLine(name="Bread")

    basket = Basket((milk,)).add(bread)

    assert basket.lines == (milk, bread)


def test_adds_to_existing_quantity_and_keeps_its_id_when_adding_same_item_again() -> None:
    milk = BasketLine(name="Milk", quantity=2)

    basket = Basket((milk,)).add(BasketLine(name="milk", quantity=3))

    assert basket.lines == (BasketLine(name="milk", quantity=5, id=milk.id),)


def test_takes_latest_ingredients_when_adding_same_recipe_again() -> None:
    recipe_id = uuid7()
    first_addition = BasketLine(name="Chilli", recipe=BasketRecipe(id=recipe_id, ingredients=("Beans",)))
    edited_recipe = BasketRecipe(id=recipe_id, ingredients=("Beans", "Rice"))

    basket = Basket((first_addition,)).add(BasketLine(name="Chilli", recipe=edited_recipe))

    assert basket.lines == (BasketLine(name="Chilli", quantity=2, recipe=edited_recipe, id=first_addition.id),)


def test_raises_quantity_when_changing_it_by_a_positive_amount() -> None:
    milk = BasketLine(name="Milk", quantity=2)

    basket = Basket((milk,)).change_quantity(milk.id, 1)

    assert basket.lines[0].quantity == 3


def test_takes_line_out_when_its_quantity_falls_to_zero() -> None:
    milk = BasketLine(name="Milk")

    basket = Basket((milk,)).change_quantity(milk.id, -1)

    assert basket.lines == ()


def test_does_nothing_when_changing_quantity_of_missing_line() -> None:
    basket = Basket((BasketLine(name="Milk"),))

    assert basket.change_quantity(uuid7(), 1) == basket


def test_keeps_other_lines_when_removing_one() -> None:
    milk = BasketLine(name="Milk")
    bread = BasketLine(name="Bread")

    basket = Basket((milk, bread)).remove(milk.id)

    assert basket.lines == (bread,)


def test_lists_each_ingredient_for_each_portion_when_listing_shopping_for_a_recipe() -> None:
    pie = BasketLine(name="Shepherd's pie", quantity=2, recipe=BasketRecipe(id=uuid7(), ingredients=("500g lamb mince", "1kg potatoes")))

    shopping = Basket((pie,)).list_shopping()

    assert shopping == (
        ShoppingListItem(name="500g lamb mince", quantity=2, needed_for=("Shepherd's pie",)),
        ShoppingListItem(name="1kg potatoes", quantity=2, needed_for=("Shepherd's pie",)),
    )


def test_buys_together_when_recipes_and_items_ask_for_the_same_thing() -> None:
    chilli = BasketLine(name="Chilli", recipe=BasketRecipe(id=uuid7(), ingredients=("1 onion", "Beans")))
    pie = BasketLine(name="Shepherd's pie", recipe=BasketRecipe(id=uuid7(), ingredients=("1 Onion",)))
    onions = BasketLine(name="1 onion", quantity=2)

    shopping = Basket((chilli, pie, onions)).list_shopping()

    assert shopping == (
        ShoppingListItem(name="1 onion", quantity=4, needed_for=("Chilli", "Shepherd's pie")),
        ShoppingListItem(name="Beans", quantity=1, needed_for=("Chilli",)),
    )


def test_lists_nothing_when_basket_is_empty() -> None:
    assert Basket().list_shopping() == ()
