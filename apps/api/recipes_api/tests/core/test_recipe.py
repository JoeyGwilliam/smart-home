import pytest

from recipes_api.core.recipe import Recipe


def test_has_no_instructions_time_or_picture_when_created_with_only_name_and_ingredients() -> None:
    recipe = Recipe(name="Beans on toast", ingredients=("Beans", "Toast"))

    assert (recipe.instructions, recipe.time_minutes, recipe.picture_id) == (None, None, None)


def test_raises_when_name_is_blank() -> None:
    with pytest.raises(ValueError, match="name"):
        Recipe(name="  ", ingredients=("Beans",))


def test_raises_when_there_are_no_ingredients() -> None:
    with pytest.raises(ValueError, match="at least one ingredient"):
        Recipe(name="Beans on toast", ingredients=())


def test_raises_when_an_ingredient_is_blank() -> None:
    with pytest.raises(ValueError, match="ingredients"):
        Recipe(name="Beans on toast", ingredients=("Beans", " "))


def test_raises_when_instructions_are_blank() -> None:
    with pytest.raises(ValueError, match="instructions"):
        Recipe(name="Beans on toast", ingredients=("Beans",), instructions="\n")


def test_raises_when_time_is_less_than_a_minute() -> None:
    with pytest.raises(ValueError, match="time_minutes"):
        Recipe(name="Beans on toast", ingredients=("Beans",), time_minutes=0)
