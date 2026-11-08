Follow PEP 8.

Always use typehints, except in redundant case (i.e., do not write `a: int = 1`)

You can break the 120 line limit if it improves readability.

Use google format docstrings for all public classes. Use an `attributes` section to document dataclasses. Always add a newline between the attribute/arg name and the description.

Use pytest for unit tests.

Prefer explicit dataclasses to complex dicts.

Prefer small files over large files. Each file should usually hold one main class. This may be violated in some cases, for example for a dataclass and a collection dataclass.

NEVER LEAVE MODULE LEVEL DOCSTRINGS AT THE TOP OF A FILE.

Start docstrings with a space.
