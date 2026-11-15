from datetime import UTC, datetime
from uuid import uuid7

import pytest

from pixel_art_api.core.preset import Preset


def test_keeps_name_when_preset_is_valid() -> None:
    preset = Preset(id=uuid7(), name="Winter", saved_at=datetime(2026, 12, 1, 9, 0, tzinfo=UTC))

    assert preset.name == "Winter"


def test_raises_value_error_when_name_is_blank() -> None:
    with pytest.raises(ValueError):
        Preset(id=uuid7(), name=" ", saved_at=datetime(2026, 12, 1, 9, 0, tzinfo=UTC))


def test_raises_value_error_when_saved_at_has_no_time_zone() -> None:
    with pytest.raises(ValueError):
        Preset(id=uuid7(), name="Winter", saved_at=datetime(2026, 12, 1, 9, 0))
