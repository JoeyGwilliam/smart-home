from dataclasses import asdict
from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from pixel_art_api.core.preset import Preset


class PresetNameSchema(BaseModel):
    """ The JSON representation of a request to save the design as a new preset, or to rename one.

    Attributes:
        name:
            What to call the preset. Must contain non-whitespace text, and be at most 80 characters.
    """
    model_config = ConfigDict(extra="forbid")

    name: str

    @field_validator("name")
    @classmethod
    def _apply_name_rules(cls, name: str) -> str:
        # Preset owns the rule, but can only be made once the design has been copied, so that a bad name would be
        # found too late to refuse the request cleanly. This is the same rule, applied first.
        if not name.strip() or len(name) > 80:
            raise ValueError("A preset's name must contain non-whitespace text, and be at most 80 characters.")
        return name


class PresetSchema(BaseModel):
    """ The JSON representation of a preset, in responses. The design that it saved stays in the API.

    Attributes:
        id:
            Unique identifier.
        name:
            What the preset is called.
        saved_at:
            When the preset was saved, in UTC.
    """

    id: UUID
    name: str
    saved_at: datetime

    @classmethod
    def from_preset(cls, preset: Preset) -> Self:
        """ Creates the JSON representation of a preset. """
        return cls(**asdict(preset))
