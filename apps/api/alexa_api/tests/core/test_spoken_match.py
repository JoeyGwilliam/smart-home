import pytest

from alexa_api.core.spoken_match import find_spoken_match


def _identity(name: str) -> str:
    return name


@pytest.mark.parametrize(
    "spoken_name",
    [
        "take out the bins",
        "Take Out The Bins!",
        "the bins",
        "take out bins",
        "take out the bin",
        "my bins reminder",
    ],
)
def test_finds_name_when_spoken_name_is_a_loose_version_of_it(spoken_name: str) -> None:
    names = ["Buy milk", "Take out the bins", "Call the dentist"]

    match = find_spoken_match(spoken_name, names, _identity)

    assert match == "Take out the bins"


@pytest.mark.parametrize("spoken_name", ["feed the cat", "", "the", "bin lorry timetable for december"])
def test_finds_nothing_when_no_name_is_like_spoken_name(spoken_name: str) -> None:
    names = ["Buy milk", "Take out the bins", "Call the dentist"]

    match = find_spoken_match(spoken_name, names, _identity)

    assert match is None


def test_finds_nothing_when_there_are_no_candidates() -> None:
    match = find_spoken_match("buy milk", [], _identity)

    assert match is None


def test_finds_closest_name_when_several_names_share_the_spoken_words() -> None:
    names = ["Buy oat milk for the weekend", "Buy milk", "Buy milk chocolate"]

    match = find_spoken_match("buy milk", names, _identity)

    assert match == "Buy milk"


def test_finds_earliest_name_when_several_names_are_equally_alike() -> None:
    names = ["Buy milk", "buy milk!"]

    match = find_spoken_match("buy milk", names, _identity)

    assert match == "Buy milk"


def test_finds_name_when_it_is_made_only_of_filler_words() -> None:
    names = ["The timer", "School run"]

    match = find_spoken_match("the timer", names, _identity)

    assert match == "The timer"


def test_gives_back_the_candidate_itself_when_names_come_from_a_field() -> None:
    presets = [{"name": "School run", "minutes": 45}, {"name": "Bedtime", "minutes": 30}]

    match = find_spoken_match("bedtime", presets, lambda preset: preset["name"])

    assert match == {"name": "Bedtime", "minutes": 30}
