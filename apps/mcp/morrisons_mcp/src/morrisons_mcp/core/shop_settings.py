import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class ShopSettings:
    """ What belongs to this machine and this household, rather than to the Morrisons website.

    Attributes:
        postcode:
            Where to deliver to, such as "BS6 5SJ". The shop's prices and stock depend on it.
        address_line:
            The start of the address, as the shop lists it under the postcode, such as "62 Sydenham Road". The first
            address under the postcode that contains this text is chosen.
        state_directory:
            Where the browser keeps what it must remember between runs: the trolley, the delivery location and, later,
            a login. Anyone who can read it can use that login, so it should be private to the person running this.
        browser_channel:
            Which installed browser to use, such as "msedge" or "chrome". None to use the browser that
            `playwright install chromium` downloads.
    """

    postcode: str
    address_line: str
    state_directory: Path = field(default_factory=lambda: Path.home() / ".morrisons_mcp")
    browser_channel: str | None = None

    @classmethod
    def from_environment(cls, environment: Mapping[str, str] = os.environ) -> ShopSettings:
        """ Reads the settings from environment variables.

        Args:
            environment:
                The variables to read, which are `MORRISONS_POSTCODE` and `MORRISONS_ADDRESS_LINE`, both required, and
                `MORRISONS_STATE_DIRECTORY` and `MORRISONS_BROWSER_CHANNEL`, both optional.

        Returns:
            The settings.

        Raises:
            ValueError: If a required variable is missing or blank.
        """
        missing_names = [
            name for name in ("MORRISONS_POSTCODE", "MORRISONS_ADDRESS_LINE") if not environment.get(name, "").strip()
        ]
        if missing_names:
            raise ValueError(f"Set these environment variables to say where to deliver to: {', '.join(missing_names)}.")

        optional_settings = {}
        if environment.get("MORRISONS_STATE_DIRECTORY"):
            optional_settings["state_directory"] = Path(environment["MORRISONS_STATE_DIRECTORY"])
        if environment.get("MORRISONS_BROWSER_CHANNEL"):
            optional_settings["browser_channel"] = environment["MORRISONS_BROWSER_CHANNEL"]

        return cls(
            postcode=environment["MORRISONS_POSTCODE"].strip(),
            address_line=environment["MORRISONS_ADDRESS_LINE"].strip(),
            **optional_settings,
        )
