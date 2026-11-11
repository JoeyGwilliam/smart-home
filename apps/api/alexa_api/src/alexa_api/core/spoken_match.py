import re
from collections.abc import Callable, Iterable
from difflib import SequenceMatcher

# How alike what was said and a name must be, from 0 to 1, to count as the same thing. Low enough to forgive a
# misheard word, and high enough that an unrelated name is never picked.
_MINIMUM_SIMILARITY = 0.6

# Words that people add or drop freely, so they say nothing about which name was meant.
_FILLER_WORDS = frozenset({"a", "an", "the", "my", "our", "to", "for", "of", "reminder", "timer"})


def find_spoken_match[Candidate](
        spoken_name: str,
        candidates: Iterable[Candidate],
        get_name: Callable[[Candidate], str],
) -> Candidate | None:
    """ Finds the thing that a person most likely meant when they said its name aloud.

    People rarely say a name exactly as it is written, and Alexa mishears words, so names are compared loosely:
    capitals, punctuation and filler words are ignored, a name counts if what was said is the gist of it, and a
    small difference in spelling is forgiven.

    Args:
        spoken_name:
            What Alexa heard as the name.
        candidates:
            The things that could have been meant.
        get_name:
            Gives the written name of a candidate.

    Returns:
        The candidate whose name is most like what was said, or the earliest of them if several are equally alike.
        None if no name is alike enough to be confident.
    """
    spoken_words = _list_meaningful_words(spoken_name)
    best_candidate = None
    best_similarity = _MINIMUM_SIMILARITY
    for candidate in candidates:
        similarity = _measure_similarity(spoken_words, _list_meaningful_words(get_name(candidate)))
        if similarity > best_similarity:
            best_candidate, best_similarity = candidate, similarity
    return best_candidate


def _list_meaningful_words(name: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", name.lower().replace("'", ""))
    # A name made only of filler words, such as "The timer", still has to be comparable.
    return [word for word in words if word not in _FILLER_WORDS] or words


def _measure_similarity(spoken_words: list[str], name_words: list[str]) -> float:
    if not spoken_words or not name_words:
        return 0
    spelling_similarity = SequenceMatcher(None, " ".join(spoken_words), " ".join(name_words)).ratio()
    # Saying part of a name, such as "the bins" for "Take out the bins", is the gist of it. It scores just below an
    # exact match, and the spelling breaks ties between names that share the words.
    is_gist_of_name = all(word in name_words for word in spoken_words)
    return 0.9 + spelling_similarity / 10 if is_gist_of_name else spelling_similarity
