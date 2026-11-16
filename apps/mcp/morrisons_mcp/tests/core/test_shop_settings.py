from pathlib import Path

import pytest

from morrisons_mcp.core.shop_settings import ShopSettings


def test_reads_address_when_both_required_variables_are_set() -> None:
    environment = {"MORRISONS_POSTCODE": " BS1 1AA ", "MORRISONS_ADDRESS_LINE": "1 High Street"}

    settings = ShopSettings.from_environment(environment)

    assert (settings.postcode, settings.address_line) == ("BS1 1AA", "1 High Street")


def test_reads_optional_settings_when_they_are_set() -> None:
    environment = {
        "MORRISONS_POSTCODE": "BS1 1AA",
        "MORRISONS_ADDRESS_LINE": "1 High Street",
        "MORRISONS_STATE_DIRECTORY": "/somewhere",
        "MORRISONS_BROWSER_CHANNEL": "msedge",
    }

    settings = ShopSettings.from_environment(environment)

    assert (settings.state_directory, settings.browser_channel) == (Path("/somewhere"), "msedge")


def test_uses_defaults_when_optional_settings_are_missing() -> None:
    environment = {"MORRISONS_POSTCODE": "BS1 1AA", "MORRISONS_ADDRESS_LINE": "1 High Street"}

    settings = ShopSettings.from_environment(environment)

    assert (settings.state_directory, settings.browser_channel) == (Path.home() / ".morrisons_mcp", None)


def test_raises_naming_the_variable_when_the_postcode_is_missing() -> None:
    environment = {"MORRISONS_ADDRESS_LINE": "1 High Street"}

    with pytest.raises(ValueError, match="MORRISONS_POSTCODE"):
        ShopSettings.from_environment(environment)


def test_raises_when_a_required_variable_is_blank() -> None:
    environment = {"MORRISONS_POSTCODE": "BS1 1AA", "MORRISONS_ADDRESS_LINE": "   "}

    with pytest.raises(ValueError, match="MORRISONS_ADDRESS_LINE"):
        ShopSettings.from_environment(environment)
